-- A document that has been cited could not be deleted.
--
-- `message_parts.chunk_id` referenced `document_chunks` with `on delete set
-- null`, while `message_parts_shape` requires `chunk_id is not null` when the
-- part is a source. So deleting a document cascaded to its chunks, which tried to
-- null the citation, which violated the constraint, which failed the delete:
--
--   new row for relation "message_parts" violates check constraint
--   "message_parts_shape"
--
-- The user-visible effect is that a document can never be removed once it has
-- been cited in an answer — which is the ordinary case, since citing is what the
-- product does. Found by deleting a test account, not by reading the schema.
--
-- The fix is `on delete cascade`: removing a document removes the citation parts
-- that pointed into it. The answer text is a separate part and is untouched, so
-- the conversation still reads correctly, it simply no longer offers a link to a
-- passage that no longer exists.
--
-- The alternative was to let a source part keep a null chunk_id. That leaves a
-- citation marker pointing at nothing, which is a worse thing to render than no
-- marker at all.

alter table public.message_parts
  drop constraint message_parts_chunk_id_fkey;

alter table public.message_parts
  add constraint message_parts_chunk_id_fkey
  foreign key (chunk_id) references public.document_chunks (id) on delete cascade;
