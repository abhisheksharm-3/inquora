-- Repositories, stored as files rather than as one blob of text.
--
-- The first version embedded every code chunk: 2,664 chunks for one repository of
-- 399 files, measured. That is the wrong shape twice over. It costs eighty
-- embedding calls to index code that a regex answers better — the specialist
-- prompt already tells the model to grep for an identifier, because a dense
-- vector flattens exactly that — and it forced the retained text into one column,
-- capped at a megabyte, so grep silently stopped covering the repository.
--
-- Files are rows now. grep matches per file and reports the path, read_file
-- returns the real lines rather than the chunk that overlapped them, and
-- embeddings are spent on documentation and declarations instead of on every
-- function body.

create table public.document_files (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  path        text not null,
  language    text not null,
  content     text not null,
  line_count  integer not null,
  bytes       integer not null,
  created_at  timestamptz not null default now(),

  constraint document_files_line_count_positive check (line_count > 0)
);

create unique index document_files_document_path_key
  on public.document_files (document_id, path);

-- Trigram matching per file, so grep over a large repository is an index scan.
create index document_files_content_trgm_idx
  on public.document_files
  using gin (content extensions.gin_trgm_ops);

alter table public.document_files enable row level security;

create policy document_files_via_document on public.document_files
  for all to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_files.document_id and d.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_files.document_id and d.user_id = (select auth.uid())));

/*
 * Matching lines across every file of a document, with the path and the line
 * number, which is what a citation into code needs.
 *
 * Replaces grepping one truncated text column: this covers the whole repository
 * and says which file each match came from.
 */
-- The return shape changes, so the old signature is dropped first: `create or
-- replace` cannot change a function's OUT parameters.
drop function if exists public.grep_document(uuid, text, integer);

create function public.grep_document(
  p_document_id uuid,
  p_pattern     text,
  p_limit       integer default 30
)
returns table (path text, line_number integer, line text)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Files first, which is where a repository's content lives.
  select f.path, l.ordinality::integer as line_number, l.line
  from public.document_files f
  cross join lateral unnest(string_to_array(f.content, E'\n'))
    with ordinality as l(line, ordinality)
  where f.document_id = p_document_id
    and f.content ~* p_pattern
    and l.line ~* p_pattern
  union all
  -- Then the single retained text of a prose document, which has no path.
  select null::text as path, l.ordinality::integer, l.line
  from public.documents d
  cross join lateral unnest(string_to_array(coalesce(d.extracted_text, ''), E'\n'))
    with ordinality as l(line, ordinality)
  where d.id = p_document_id
    and not exists (select 1 from public.document_files f where f.document_id = d.id)
    and l.line ~* p_pattern
  order by path nulls first, line_number
  limit least(greatest(p_limit, 1), 200);
$$;

/*
 * The real lines of one file, rather than the chunks that happened to overlap the
 * range. A caller asking for lines 40 to 60 gets lines 40 to 60.
 */
drop function if exists public.read_document_file(uuid, text, integer, integer);

create function public.read_document_file(
  p_document_id uuid,
  p_path        text,
  p_from_line   integer default 1,
  p_to_line     integer default 400
)
returns table (path text, from_line integer, to_line integer, line_count integer, content text)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.path,
         greatest(p_from_line, 1) as from_line,
         least(p_to_line, f.line_count) as to_line,
         f.line_count,
         (
           select string_agg(l.line, E'\n' order by l.ordinality)
           from unnest(string_to_array(f.content, E'\n')) with ordinality as l(line, ordinality)
           where l.ordinality between greatest(p_from_line, 1) and least(p_to_line, f.line_count)
         ) as content
  from public.document_files f
  where f.document_id = p_document_id and f.path = p_path;
$$;

/** Written per file during ingestion, one statement for the batch. */
create function public.insert_document_files(
  p_document_id uuid,
  p_files       jsonb
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with inserted as (
    insert into public.document_files (document_id, path, language, content, line_count, bytes)
    select p_document_id,
           f ->> 'path',
           f ->> 'language',
           f ->> 'content',
           greatest((f ->> 'lineCount')::integer, 1),
           (f ->> 'bytes')::integer
    from jsonb_array_elements(p_files) as f
    on conflict (document_id, path) do update
      set content    = excluded.content,
          language   = excluded.language,
          line_count = excluded.line_count,
          bytes      = excluded.bytes
    returning 1
  )
  select count(*)::integer from inserted;
$$;

-- A repository is ready when its files are stored, even before every chunk is
-- embedded, because grep and read_file already work at that point.
create or replace function public.sync_document_chunk_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
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
