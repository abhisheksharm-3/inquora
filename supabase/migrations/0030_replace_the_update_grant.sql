-- The column revoke in 0029 did nothing, and the check confirmed it.
--
-- `revoke update (status, ...) from authenticated` cannot reduce a role that
-- holds table-level UPDATE: the table grant already implies every column, and
-- subtracting columns from it is not a thing Postgres does. The forged PATCH was
-- still accepted after that migration, which is why it was re-tested rather than
-- assumed.
--
-- The grant has to be replaced: take UPDATE on the table away, then give it back
-- for exactly the columns a person may change about their own document.

revoke update on public.documents from authenticated, anon;

grant update (title, kind, byte_size, storage_path, source_url) on public.documents
  to authenticated;

-- INSERT stays whole: a new row needs user_id and content_hash, and the policy
-- already restricts it to the caller's own id.
