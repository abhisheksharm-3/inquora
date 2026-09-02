begin;
select plan(6);

-- The queue is service-role work. A client role holding EXECUTE on any of these
-- is the hole that shipped: each is security definer, so EXECUTE is the whole
-- authorization boundary.
select ok(
  not has_function_privilege('anon', 'public.claim_ingestion_job()', 'execute'),
  'anon cannot claim a job');
select ok(
  not has_function_privilege('authenticated', 'public.claim_ingestion_job()', 'execute'),
  'an authenticated user cannot claim a job');
select ok(
  not has_function_privilege('authenticated', 'public.fail_ingestion_job(bigint, text)', 'execute'),
  'an authenticated user cannot fail somebody else''s job');
select ok(
  not has_function_privilege('authenticated', 'public.complete_ingestion_job(bigint)', 'execute'),
  'an authenticated user cannot complete a job');
select ok(
  not has_function_privilege('anon', 'public.poke_ingestion_worker()', 'execute'),
  'anon cannot make the database call the worker');

-- And the worker itself must still work.
select ok(
  has_function_privilege('service_role', 'public.claim_ingestion_job()', 'execute'),
  'the service role can still claim a job');

select * from finish();
rollback;
