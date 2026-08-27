-- The queue needs something to drain it, and somebody to be told when it stops.
--
-- The failure this prevents is the one that started the rebuild: 213 of 241
-- documents sat unprocessed for eleven days because the only signal was a status
-- column nobody was watching.

-- No `with schema` clause: Supabase installs pg_cron against pg_catalog with its
-- functions in `cron`, and pg_net in public with its functions in `net`. Naming a
-- schema here fails with a cross-database reference error at first use.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Jobs that were claimed and never finished. A row here means work is stuck, not
-- slow: attempts has already been incremented and run_after has already passed.
create view public.stuck_ingestion_jobs
with (security_invoker = true) as
select j.id            as job_id,
       j.document_id,
       d.title,
       d.status,
       j.attempts,
       j.last_error,
       j.run_after,
       now() - j.run_after as overdue_by
from public.ingestion_jobs j
join public.documents d on d.id = j.document_id
where j.run_after < now() - interval '5 minutes'
  and j.attempts > 0;

comment on view public.stuck_ingestion_jobs is
  'Work the queue accepted and did not finish. Empty is the healthy state. '
  'This is the view an alert reads, so nothing has to remember to check a column.';

-- Ingestion cost and throughput as plain SQL, which is what makes "cost per
-- answer" answerable without an export.
create view public.ingestion_health
with (security_invoker = true) as
select count(*) filter (where status = 'pending')    as pending,
       count(*) filter (where status = 'processing') as processing,
       count(*) filter (where status = 'ready')      as ready,
       count(*) filter (where status = 'failed')     as failed,
       coalesce(sum(chunk_count), 0)                 as chunks_stored
from public.documents;

-- Drain on a schedule for the crash case, and immediately on enqueue for the
-- common one. The worker endpoint is read from a setting rather than hardcoded,
-- so the same migration works against any deployment.
create function public.poke_ingestion_worker()
returns void
language plpgsql
security definer
set search_path = 'net'
as $$
declare
  worker_url text := current_setting('app.settings.ingestion_worker_url', true);
  worker_key text := current_setting('app.settings.ingestion_worker_key', true);
begin
  if worker_url is null or worker_url = '' then
    -- Nothing configured yet. The scheduled drain still runs, so work is late
    -- rather than lost.
    return;
  end if;

  perform net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
                 'content-type', 'application/json',
                 'authorization', 'Bearer ' || coalesce(worker_key, '')),
    body    := '{}'::jsonb
  );
end;
$$;

create function public.on_ingestion_enqueued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.poke_ingestion_worker();
  return null;
end;
$$;

create trigger ingestion_jobs_poke_worker
  after insert on public.ingestion_jobs
  for each statement execute function public.on_ingestion_enqueued();

-- Every minute. The poke handles the common case; this is the safety net for a
-- worker that died mid-job or a poke that never arrived.
select cron.schedule(
  'drain-ingestion',
  '* * * * *',
  $$select public.poke_ingestion_worker()$$
);
