create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         public.document_kind not null,
  title        text not null,
  byte_size    bigint,
  storage_path text,
  source_url   text,
  status       public.processing_status not null default 'pending',
  error        text,
  chunk_count  integer not null default 0,
  -- Written by the extractor before embedding starts, so ingestion progress is a
  -- fraction rather than one of four words.
  expected_chunks integer,
  content_hash text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  indexed_at   timestamptz,

  constraint documents_chunk_count_non_negative check (chunk_count >= 0),
  -- A document is either stored by us or fetched from a URL, never neither.
  constraint documents_has_a_source check (storage_path is not null or source_url is not null)
);

-- Re-uploading the same bytes reuses the existing chunks rather than paying to
-- embed them again.
create unique index documents_user_content_hash_key
  on public.documents (user_id, content_hash);

create index documents_user_created_idx on public.documents (user_id, created_at desc);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function extensions.moddatetime (updated_at);

create table public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  content     text not null,
  embedding   extensions.vector(1024) not null,
  token_count integer,
  metadata    jsonb not null default '{}'::jsonb,
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  created_at  timestamptz not null default now(),

  constraint document_chunks_index_non_negative check (chunk_index >= 0),
  constraint document_chunks_content_not_blank check (length(btrim(content)) > 0)
);

create unique index document_chunks_document_index_key
  on public.document_chunks (document_id, chunk_index);

-- Indexing the half-precision cast halves index size and memory with recall
-- loss in the noise.
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw ((embedding::extensions.halfvec(1024)) extensions.halfvec_cosine_ops);

create index document_chunks_tsv_idx on public.document_chunks using gin (tsv);

-- Derived state the application used to own and mostly failed to write: in the
-- old schema 213 of 241 files sat at 'idle' because the write-back rarely fired,
-- so every chat open re-derived the answer from the vector store instead.
create function public.sync_document_chunk_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  -- A statement-level trigger has no NEW or OLD, so the affected documents come
  -- from the transition table each trigger declares. plpgsql plans a branch on
  -- first execution, so the branch naming the other table is never planned here.
  if tg_op = 'INSERT' then
    select array_agg(distinct document_id) into ids from inserted;
  else
    select array_agg(distinct document_id) into ids from deleted;
  end if;

  update public.documents d
  set chunk_count = t.total,
      status      = case
                      when t.total > 0 and d.status <> 'failed' then 'ready'::public.processing_status
                      when t.total = 0 and d.status = 'ready'   then 'pending'::public.processing_status
                      else d.status
                    end,
      indexed_at  = case when t.total > 0 then now() else null end
  from (
    select u.id, count(ch.id)::integer as total
    from unnest(ids) as u(id)
    left join public.document_chunks ch on ch.document_id = u.id
    group by u.id
  ) t
  where d.id = t.id;

  return null;
end;
$$;

-- One trigger per operation, because a transition table is declared per event.
-- Statement level, not row level: a bulk insert of 100 chunks recounts once.
create trigger document_chunks_sync_count_insert
  after insert on public.document_chunks
  referencing new table as inserted
  for each statement execute function public.sync_document_chunk_count();

create trigger document_chunks_sync_count_delete
  after delete on public.document_chunks
  referencing old table as deleted
  for each statement execute function public.sync_document_chunk_count();
