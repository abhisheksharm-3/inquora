-- A queue in the database rather than a queue service. FOR UPDATE SKIP LOCKED
-- has been the Postgres answer to this for years, and the alternative was a
-- vendor for a workload of a few hundred documents.
create table public.ingestion_jobs (
  id          bigserial primary key,
  document_id uuid not null unique references public.documents (id) on delete cascade,
  attempts    integer not null default 0,
  run_after   timestamptz not null default now(),
  last_error  text,
  created_at  timestamptz not null default now()
);

create index ingestion_jobs_runnable_idx
  on public.ingestion_jobs (run_after)
  where attempts < 5;

alter table public.ingestion_jobs enable row level security;
-- No policy: only the service role touches the queue. Authenticated users see
-- progress through documents.status, which they do own.

create function public.enqueue_ingestion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ingestion_jobs (document_id)
  values (new.id)
  on conflict (document_id) do update
    set run_after  = now(),
        attempts   = 0,
        last_error = null;
  return null;
end;
$$;

create trigger documents_enqueue_ingestion
  after insert on public.documents
  for each row execute function public.enqueue_ingestion();

create function public.claim_ingestion_job()
returns table (job_id bigint, document_id uuid, attempts integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed public.ingestion_jobs;
begin
  select * into claimed
  from public.ingestion_jobs j
  where j.run_after <= now() and j.attempts < 5
  order by j.id
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.ingestion_jobs
  set attempts  = claimed.attempts + 1,
      run_after = now() + (interval '30 seconds' * power(2, claimed.attempts))
  where id = claimed.id;

  update public.documents
  set status = 'processing'
  where id = claimed.document_id and status <> 'ready';

  job_id      := claimed.id;
  document_id := claimed.document_id;
  attempts    := claimed.attempts + 1;
  return next;
end;
$$;

create function public.complete_ingestion_job(p_job_id bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.ingestion_jobs where id = p_job_id;
$$;

create function public.fail_ingestion_job(p_job_id bigint, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  doc uuid;
  tries integer;
begin
  update public.ingestion_jobs
  set last_error = p_error
  where id = p_job_id
  returning document_id, attempts into doc, tries;

  if tries >= 5 then
    update public.documents
    set status = 'failed', error = p_error
    where id = doc;
  end if;
end;
$$;
