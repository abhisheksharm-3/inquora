-- Derived state was enforced against the worker and not against the browser.
--
-- ADR 0003 puts integrity and aggregation in Postgres so derived state stops
-- drifting, and the triggers do exactly that — for anything writing through the
-- worker. `documents_owner` is `for all to authenticated` with no column
-- restriction, and PostgREST accepts a column list, so a signed-in user could
-- send one PATCH and set their own document to `ready` with `chunk_count: 9999`.
-- Demonstrated against this project before writing this: the update was accepted
-- and the row kept the fabricated values.
--
-- The consequences are not cosmetic. `get_chat_context` hands the model a
-- document whose status says it is searchable; the count trigger only recomputes
-- when a chunk row changes, so nothing corrects it; and the progress broadcast
-- publishes the invented state as fact. `extracted_text` is worse again — it is
-- prompt content the model reads, and it was writable by the same request.
--
-- A policy decides which rows. Which columns is a grant, so that is where the
-- rule goes.

revoke update (
  status,
  chunk_count,
  expected_chunks,
  indexed_at,
  error,
  outline,
  extracted_text,
  content_hash,
  user_id,
  created_at
) on public.documents from authenticated, anon;

-- What a person may still change about their own document: what it is called, and
-- where it came from.
comment on table public.documents is
  'A document and its ingestion state. Only title, kind, byte_size, storage_path '
  'and source_url are client-writable; every derived column is maintained by '
  'trigger and revoked from client roles, because a policy chooses rows and a '
  'grant chooses columns.';

-- The same reasoning for the two child tables a client has no reason to write at
-- all: chunks and files are produced by ingestion.
revoke insert, update, delete on public.document_chunks from authenticated, anon;
revoke insert, update, delete on public.document_files from authenticated, anon;

-- Reading stays exactly as it was, under the existing policies.
grant select on public.document_chunks to authenticated;
grant select on public.document_files to authenticated;

-- And the constraint that makes the invariant readable rather than only enforced
-- by whoever remembers the trigger.
alter table public.documents
  add constraint documents_ready_has_chunks
  check (status <> 'ready' or chunk_count > 0);
