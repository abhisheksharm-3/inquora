begin;
select plan(8);

-- A policy chooses rows; a grant chooses columns. These assert the grant, because
-- the policy passing is exactly what made the hole invisible.
select ok(
  not has_column_privilege('authenticated', 'public.documents', 'status', 'update'),
  'a client cannot write documents.status');
select ok(
  not has_column_privilege('authenticated', 'public.documents', 'chunk_count', 'update'),
  'nor chunk_count');
select ok(
  not has_column_privilege('authenticated', 'public.documents', 'extracted_text', 'update'),
  'nor extracted_text, which is prompt content the model reads');
select ok(
  not has_column_privilege('authenticated', 'public.documents', 'content_hash', 'update'),
  'nor content_hash, which is how a duplicate is recognised');

-- And what a person may still change about their own document.
select ok(
  has_column_privilege('authenticated', 'public.documents', 'title', 'update'),
  'a client can rename its own document');

-- Chunks and files are produced by ingestion, never by a client.
select ok(
  not has_table_privilege('authenticated', 'public.document_chunks', 'insert'),
  'a client cannot insert a chunk, so it cannot inject prompt content');
select ok(
  has_table_privilege('authenticated', 'public.document_chunks', 'select'),
  'but it can still read its own chunks, under the policy');

-- The invariant, stated as a constraint rather than left to whoever remembers.
select ok(
  (select count(*)::int from pg_constraint
   where conname = 'documents_ready_has_chunks') = 1,
  'a ready document must have chunks, enforced by the schema');

select * from finish();
rollback;
