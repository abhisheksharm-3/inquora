begin;
select plan(6);

-- Two accounts, so "somebody else's document" is a real case rather than a
-- hypothetical one.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@example.com'),
  ('00000000-0000-4000-8000-0000000000a2', 'stranger@example.com');

-- storage_path, because documents_has_a_source requires one of the two, and a
-- fixture that skips it is testing the constraint rather than the function.
insert into public.documents
  (id, user_id, kind, title, content_hash, storage_path, status, error, chunk_count)
values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1',
   'pdf', 'failed.pdf', repeat('a', 64), 'a1/failed.pdf', 'failed', 'the file is encrypted', 0),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1',
   'pdf', 'ready.pdf', repeat('b', 64), 'a1/ready.pdf', 'ready', null, 9),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a2',
   'pdf', 'theirs.pdf', repeat('c', 64), 'a2/theirs.pdf', 'failed', 'also encrypted', 0);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

-- A failed document of my own goes back to pending, and its error is cleared.
select lives_ok(
  $$select public.retry_ingestion('00000000-0000-4000-8000-0000000000d1')$$,
  'the owner may retry their own failed document');

select is(
  (select status::text from public.documents where id = '00000000-0000-4000-8000-0000000000d1'),
  'pending',
  'and it is pending again');

select is(
  (select error from public.documents where id = '00000000-0000-4000-8000-0000000000d1'),
  null,
  'with the previous failure cleared');

-- The requeue trigger from 0023 is what actually makes it run again.
-- A signed-in person cannot see the queue at all, which is deliberate, so this
-- one is checked as the owner. Asserting it as `authenticated` was testing that
-- the queue is private, not that the job was written.
reset role;

select isnt_empty(
  $$select 1 from public.ingestion_jobs
     where document_id = '00000000-0000-4000-8000-0000000000d1'$$,
  'and a job exists for it');

set local role authenticated;

-- A document that already worked is left alone, because re-reading it would
-- discard its passages and pay to embed them again.
select throws_ok(
  $$select public.retry_ingestion('00000000-0000-4000-8000-0000000000d2')$$,
  'no document of yours to retry',
  'a ready document is not retried');

-- Somebody else's failure is not mine to retry, and the function says nothing
-- about whether it exists.
select throws_ok(
  $$select public.retry_ingestion('00000000-0000-4000-8000-0000000000d3')$$,
  'no document of yours to retry',
  'and a stranger''s document is refused');

select * from finish();
rollback;
