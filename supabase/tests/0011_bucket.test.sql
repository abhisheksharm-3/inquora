begin;
select plan(3);

select is(
  (select public from storage.buckets where id = 'documents'),
  false,
  'the documents bucket is private');

select is(
  (select file_size_limit from storage.buckets where id = 'documents'),
  52428800::bigint,
  'the bucket enforces the same 50MB limit the upload schema does');

-- Three policies, so a signed-in user reaches their own folder and no other.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'documents_bucket_owner_%'),
  3,
  'the bucket is scoped to the owner for read, write and delete');

select * from finish();
rollback;
