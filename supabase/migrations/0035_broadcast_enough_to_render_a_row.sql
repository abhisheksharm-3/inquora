-- Four more scalars in the progress broadcast.
--
-- 0025 cut the payload down to the five fields a progress bar needs, which was
-- right: broadcasting the whole row shipped the document's entire text twice
-- per event. But the interface now renders a document row from the event alone
-- — a document added in another tab, or a link the server inserted, arrives
-- this way and has no other source — and a row needs its size, when it was
-- indexed, and when it last moved.
--
-- These are four scalars. The reason 0025 mattered was `extracted_text` and
-- `outline`, which are not here and are not coming back.
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
        'error', new.error,
        'byteSize', new.byte_size,
        'createdAt', new.created_at,
        -- What tells a watcher whether a document is working slowly or has
        -- stopped. Without it the interface cannot tell those apart, and it
        -- offered to retry a document that was making progress.
        'updatedAt', new.updated_at,
        'indexedAt', new.indexed_at
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
