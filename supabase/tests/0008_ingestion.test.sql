begin;
select plan(4);

select has_table('public', 'ingestion_jobs', 'the job table exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'queue-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'pdf', 'Queue fixture', 'hash-queue', 'fixtures/queue.pdf');

select is(
  (select count(*)::int from public.ingestion_jobs
   where document_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'inserting a document enqueues exactly one job');

-- The queue is shared with whatever else is running, and claim takes the oldest
-- runnable job. Inside this rolled-back transaction the rest are removed, so the
-- assertion is about the claim rather than about what happened to be queued.
delete from public.ingestion_jobs
where document_id <> 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select document_id from public.claim_ingestion_job()),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'a worker can claim the pending job');

select is(
  (select status::text from public.documents
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'processing',
  'claiming a job marks the document as processing');

select * from finish();
rollback;
