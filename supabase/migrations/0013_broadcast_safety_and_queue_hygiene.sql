-- Three corrections that came out of running the previous migration against real
-- data.

-- 1. A notification must never fail the write that caused it.
--
-- realtime.broadcast_changes writes to realtime.messages, which can fail for
-- reasons that have nothing to do with the transaction in hand: a partition that
-- has not been created yet, a permission, a quota. Losing a progress event is a
-- worse interface for a moment. Losing an ingestion claim is lost work.
create or replace function public.broadcast_document_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.broadcast_changes(
      'user:' || new.user_id::text,
      'document_progress',
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old,
      'ROW'
    );
  exception when others then
    -- Deliberately swallowed. The row is already written; the watcher will see
    -- the state on its next read.
    null;
  end;

  return null;
end;
$$;

create or replace function public.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.broadcast_changes(
      'chat:' || new.chat_id::text,
      'message',
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old,
      'ROW'
    );
  exception when others then
    null;
  end;

  return null;
end;
$$;

-- 2. An unauthenticated caller must get false, not null.
--
-- `uuid = null` is null, and a policy that evaluates to null denies but also
-- makes the function useless to test and to read.
create or replace function public.topic_owner_matches(p_topic text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    case
      when (select auth.uid()) is null then false
      when p_topic ~ '^user:[0-9a-fA-F-]{36}$'
        then split_part(p_topic, ':', 2)::uuid = (select auth.uid())
      when p_topic ~ '^chat:[0-9a-fA-F-]{36}$'
        then exists (
          select 1 from public.chats c
          where c.id = split_part(p_topic, ':', 2)::uuid
            and c.user_id = (select auth.uid()))
      else false
    end,
    false);
$$;

-- 3. A ready document must not keep a queued job.
--
-- Found in the queue: one job for a document already at ready, left by a path
-- that wrote chunks without going through the worker. A worker would claim it and
-- pay to extract and embed a document that is already indexed.
create function public.clear_ingestion_job_when_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ingestion_jobs where document_id = new.id;
  return null;
end;
$$;

create trigger documents_clear_job_when_ready
  after update of status on public.documents
  for each row
  when (new.status = 'ready' and old.status is distinct from 'ready')
  execute function public.clear_ingestion_job_when_ready();

-- The claim skips a document that is already indexed, so a job that predates
-- this trigger cannot cost an extraction either.
create or replace function public.claim_ingestion_job()
returns table (job_id bigint, document_id uuid, attempts integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed public.ingestion_jobs;
begin
  select j.* into claimed
  from public.ingestion_jobs j
  join public.documents d on d.id = j.document_id
  where j.run_after <= now()
    and j.attempts < 5
    and d.status <> 'ready'
  order by j.id
  for update of j skip locked
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

-- The row that prompted all this.
delete from public.ingestion_jobs j
using public.documents d
where d.id = j.document_id and d.status = 'ready';
