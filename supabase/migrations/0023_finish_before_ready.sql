-- A document is ready when it is finished, not when it has started.
--
-- Three reviews found the same defect from different directions, and it is the
-- failure this rebuild exists to prevent, reintroduced through a different door.
--
-- `sync_document_chunk_count` flipped `status` to `ready` as soon as one chunk
-- existed. The worker writes chunks in batches of 32, so a 711-chunk repository
-- was `ready` after 4.5% of it was indexed. That status change fired
-- `documents_clear_job_when_ready`, which deleted the queue row, so a worker that
-- died on batch two left a document reporting `ready` with a fifth of its content,
-- no job to retry it, and nothing in `stuck_ingestion_jobs` — because the row was
-- gone. The resume-from-high-water code could never run.
--
-- And `fail_ingestion_job` recorded nothing in that state: its
-- `update ... returning ... into` matched no row, so `tries` was null, `tries >= 5`
-- was null, and the function returned success having done nothing.

/*
 * Ready means every expected chunk is stored.
 *
 * `expected_chunks` is written before embedding starts, so it is available for
 * every kind. A repository is the exception on purpose: its files are stored
 * first and grep and read_file already work, so it is ready once they exist even
 * while the summaries are still embedding.
 */
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
                      when d.status = 'failed' then d.status
                      when t.total = 0 then
                        case when d.status = 'ready' then 'pending'::public.processing_status
                             else d.status end
                      -- Finished, or a repository whose files are already usable.
                      when t.total >= coalesce(d.expected_chunks, t.total)
                        or exists (select 1 from public.document_files f where f.document_id = d.id)
                        then 'ready'::public.processing_status
                      else 'processing'::public.processing_status
                    end,
      -- coalesce, so this reads as when the document was first usable rather than
      -- being restamped by every batch.
      indexed_at  = case when t.total > 0 then coalesce(d.indexed_at, now()) else null end
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

/*
 * A failure with no job row must still be recorded, or the document is stuck
 * silently — which is exactly what happened.
 */
create or replace function public.fail_ingestion_job(p_job_id bigint, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  doc   uuid;
  tries integer;
begin
  update public.ingestion_jobs
  set last_error = p_error
  where id = p_job_id
  returning document_id, attempts into doc, tries;

  if doc is null then
    raise exception 'no ingestion job % to fail', p_job_id
      using hint = 'the job was completed or cleared before the failure was reported';
  end if;

  -- The last attempt is the one that marks the document, so the reason survives
  -- where a user can see it.
  if tries >= 5 then
    update public.documents
    set status = 'failed', error = p_error
    where id = doc;
  end if;
end;
$$;

revoke all on function public.fail_ingestion_job(bigint, text) from public, anon, authenticated;
grant execute on function public.fail_ingestion_job(bigint, text) to service_role;

/*
 * A document that is pending or failed again belongs in the queue. Without this,
 * the only path back in was inserting the row, so a re-uploaded file that matched
 * an existing content hash could never be retried.
 */
create function public.requeue_ingestion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ingestion_jobs (document_id)
  values (new.id)
  on conflict (document_id) do update
    set run_after  = now(),
        attempts   = 0,
        last_error = null;

  return null;
end;
$$;

create trigger documents_requeue_on_retry
  after update of status on public.documents
  for each row
  when (new.status in ('pending', 'failed') and old.status is distinct from new.status)
  execute function public.requeue_ingestion();

-- The lexical arm's limit had no ordering, so which forty candidates survived was
-- a property of the plan rather than of the ranking.
drop function if exists public.search_chunks(uuid[], extensions.vector, text, integer, integer);

create function public.search_chunks(
  p_document_ids uuid[],
  p_embedding    extensions.vector(1024),
  p_query        text,
  p_limit        integer default 12,
  p_k            integer default 60
)
returns table (
  chunk_id    uuid,
  document_id uuid,
  chunk_index integer,
  content     text,
  metadata    jsonb,
  score       real,
  embedding   extensions.halfvec(1024)
)
language sql
stable
security invoker
set search_path = ''
as $$
  with dense as (
    select c.id,
           row_number() over (
             order by (c.embedding::extensions.halfvec(1024))
                      operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
           ) as rank
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
    order by (c.embedding::extensions.halfvec(1024))
             operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
    limit greatest(p_limit * 4, 40)
  ),
  ranked_lexical as (
    select c.id,
           ts_rank_cd(c.tsv, websearch_to_tsquery('english', p_query)) as rank_score
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
      and c.tsv @@ websearch_to_tsquery('english', p_query)
    -- Ordered before the cut, so the forty kept are the forty best rather than
    -- whichever forty the plan produced first.
    order by rank_score desc
    limit greatest(p_limit * 4, 40)
  ),
  lexical as (
    select id, row_number() over (order by rank_score desc) as rank
    from ranked_lexical
  ),
  fused as (
    select coalesce(d.id, l.id) as id,
           coalesce(1.0 / (p_k + d.rank), 0.0)
             + coalesce(1.0 / (p_k + l.rank), 0.0) as score
    from dense d
    full outer join lexical l on l.id = d.id
  )
  select c.id, c.document_id, c.chunk_index, c.content, c.metadata, f.score::real,
         c.embedding::extensions.halfvec(1024)
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc, c.chunk_index
  limit p_limit;
$$;

-- The embedding arrives as pgvector's own text format, so it needs no
-- element-by-element rebuild — which also had no ORDER BY on its array_agg, so a
-- different plan could have stored a scrambled vector with nothing to catch it.
create or replace function public.insert_document_chunks(
  p_document_id uuid,
  p_chunks      jsonb
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with inserted as (
    insert into public.document_chunks
      (document_id, chunk_index, content, embedding, token_count, metadata)
    select
      p_document_id,
      (c ->> 'chunk_index')::integer,
      c ->> 'content',
      (c ->> 'embedding')::extensions.vector(1024),
      nullif(c ->> 'token_count', '')::integer,
      coalesce(c -> 'metadata', '{}'::jsonb)
    from jsonb_array_elements(p_chunks) as c
    on conflict (document_id, chunk_index) do update
      set content     = excluded.content,
          embedding   = excluded.embedding,
          token_count = excluded.token_count,
          metadata    = excluded.metadata
    returning 1
  )
  select count(*)::integer from inserted;
$$;
