-- Broadcast the five fields a progress bar needs, not the whole row.
--
-- `realtime.broadcast_changes(..., new, old, 'ROW')` serialises both tuples into
-- the message. Since documents gained `extracted_text` and `outline`, and the
-- worker writes both before embedding starts, every subsequent chunk-count update
-- carried the document's entire text twice. A 300-page PDF is roughly 600KB of
-- text, so about 1.2MB per event across two dozen events — thirty megabytes of
-- Realtime egress to deliver a fraction.
--
-- Worse than the waste: above Realtime's payload ceiling the broadcast fails, and
-- the exception handler added for safety swallows it. Progress silently stopped
-- working for exactly the large documents where progress matters, and nothing
-- said so.

create or replace function public.broadcast_document_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'id', new.id,
        'status', new.status,
        'chunkCount', new.chunk_count,
        'expectedChunks', new.expected_chunks,
        'title', new.title,
        'kind', new.kind,
        'error', new.error
      ),
      'document_progress',
      'user:' || new.user_id::text,
      true
    );
  exception when others then
    -- Deliberately swallowed: the row is already written, and a watcher sees the
    -- state on its next read. Losing a notification is not losing work.
    null;
  end;

  return null;
end;
$$;

/*
 * A message arriving in a conversation. The id only: the parts are a separate
 * table, and a second device fetching the message it was told about costs one
 * query and keeps every payload small.
 */
create or replace function public.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'id', new.id,
        'chatId', new.chat_id,
        'role', new.role,
        'parentId', new.parent_id,
        'createdAt', new.created_at
      ),
      'message',
      'chat:' || new.chat_id::text,
      true
    );
  exception when others then
    null;
  end;

  return null;
end;
$$;

-- Three indexes no query can use, each paid for on every write.
--
-- documents_extracted_text_trgm: grep never puts a predicate on extracted_text —
-- it unnests the column and matches per line, with the document found by primary
-- key. A GIN trigram index over the full text of every prose document, unusable.
--
-- document_files_content_trgm: every grep is scoped to one document, and
-- document_files_document_path_key already leads with document_id over ~500 rows.
-- A whole-table GIN scan cannot beat that, so the planner will not choose it.
--
-- document_chunks_metadata_path: dead since files became rows. The function that
-- read that jsonb key was dropped and replaced.
drop index if exists public.documents_extracted_text_trgm_idx;
drop index if exists public.document_files_content_trgm_idx;
drop index if exists public.document_chunks_metadata_path_idx;

-- read_file is bounded, or one call can pull a 200KB file into a context that is
-- then resent on every remaining turn of the tool loop.
create or replace function public.read_document_file(
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
         least(least(p_to_line, greatest(p_from_line, 1) + 399), f.line_count) as to_line,
         f.line_count,
         (
           select string_agg(l.line, E'\n' order by l.ordinality)
           from unnest(string_to_array(f.content, E'\n')) with ordinality as l(line, ordinality)
           where l.ordinality between greatest(p_from_line, 1)
                                  and least(least(p_to_line, greatest(p_from_line, 1) + 399), f.line_count)
         ) as content
  from public.document_files f
  where f.document_id = p_document_id and f.path = p_path;
$$;

comment on function public.read_document_file is
  'Up to four hundred real lines of one file. Bounded here rather than in the '
  'caller, because the caller is a language model choosing its own range.';
