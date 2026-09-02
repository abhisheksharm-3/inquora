-- Two lookups the last tools need, as functions rather than as filters a caller
-- has to get right.

/*
 * The chunks of one file of a repository, by path and line range.
 *
 * The path lives in chunk metadata, written by the code chunker. Matching it here
 * rather than in TypeScript keeps the caller from having to know that metadata is
 * jsonb and that the key is `path`.
 */
create function public.read_document_file(
  p_document_id uuid,
  p_path        text,
  p_from_line   integer default 1,
  p_to_line     integer default 400
)
returns table (chunk_index integer, content text, from_line integer, to_line integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.chunk_index,
         c.content,
         (c.metadata ->> 'fromLine')::integer as from_line,
         (c.metadata ->> 'toLine')::integer as to_line
  from public.document_chunks c
  where c.document_id = p_document_id
    and c.metadata ->> 'path' = p_path
    -- Overlapping the requested range, so a chunk straddling the start is not
    -- skipped and its beginning lost.
    and coalesce((c.metadata ->> 'toLine')::integer, 0) >= p_from_line
    and coalesce((c.metadata ->> 'fromLine')::integer, 0) <= p_to_line
  order by c.chunk_index
  limit 40;
$$;

/*
 * A segment of a video transcript by time.
 *
 * Timestamps live in chunk metadata as startSeconds and endSeconds, written by
 * the transcript chunker.
 */
create function public.read_document_transcript(
  p_document_id uuid,
  p_start_s     integer default 0,
  p_end_s       integer default 600
)
returns table (chunk_index integer, content text, start_s integer, end_s integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.chunk_index,
         c.content,
         (c.metadata ->> 'startSeconds')::integer as start_s,
         (c.metadata ->> 'endSeconds')::integer as end_s
  from public.document_chunks c
  where c.document_id = p_document_id
    and coalesce((c.metadata ->> 'endSeconds')::integer, 0) >= p_start_s
    and coalesce((c.metadata ->> 'startSeconds')::integer, 0) <= p_end_s
  order by c.chunk_index
  limit 40;
$$;

-- Both read metadata keys, so an index on them keeps a repository of four hundred
-- files from a sequential scan per call.
create index document_chunks_metadata_path_idx
  on public.document_chunks ((metadata ->> 'path'))
  where metadata ? 'path';
