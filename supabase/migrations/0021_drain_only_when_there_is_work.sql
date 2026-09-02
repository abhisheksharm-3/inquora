-- Do not wake the worker for an empty queue.
--
-- The schedule fired every minute unconditionally, which is 43,000 function
-- invocations a month spent asking whether there is anything to do. The answer is
-- one indexed query, and it belongs in the database.
--
-- The poke on enqueue is what makes the common case instant. This schedule is the
-- safety net for a poke that never arrived or a worker that died mid-job, so it
-- only has to fire when work is actually waiting.
select cron.unschedule('drain-ingestion');

select cron.schedule(
  'drain-ingestion',
  '* * * * *',
  $$
  select public.poke_ingestion_worker()
  where exists (
    select 1 from public.ingestion_jobs
    where run_after <= now() and attempts < 5
  )
  $$
);

-- pg_net keeps every response it received. Nothing reads them after a failure is
-- diagnosed, and they are the only rows in this database that grow without bound.
select cron.schedule(
  'prune-http-responses',
  '17 4 * * *',
  $$delete from net._http_response where created < now() - interval '3 days'$$
);
