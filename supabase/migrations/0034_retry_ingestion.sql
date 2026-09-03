-- Retrying a document that failed or stalled.
--
-- There was no way to do this from the interface, and no way to add one: a
-- browser cannot write `documents.status` or `documents.error`, because
-- migration 0030 revoked table-level update and granted only the columns a
-- person legitimately edits. That revocation closed a real hole — a browser
-- could forge a document's status while every RLS test passed — so the answer
-- is not to widen the grant but to offer the one transition that makes sense.
--
-- security definer, because the caller cannot write those columns by design,
-- with `search_path = ''` and ownership decided by auth.uid() rather than by a
-- parameter. The requeue trigger from 0023 does the rest: a document going back
-- to `pending` inserts or resets its ingestion job.
-- Dropped by name first. `create or replace` cannot change a signature, and a
-- migration has to be safe to re-apply against a database where an earlier
-- attempt already created it.
drop function if exists public.retry_ingestion(uuid);

create function public.retry_ingestion(p_document_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.documents
     set status = 'pending',
         error = null,
         chunk_count = 0,
         expected_chunks = null
   where id = p_document_id
     and user_id = (select auth.uid())
     -- Every state except ready. `processing_status` has four values and no
     -- `queued`; a document waiting in the queue is `pending`. A ready document
     -- is not retried, because re-reading one that already worked would discard
     -- its passages and pay to embed them again.
     and status in ('failed', 'processing', 'pending');

  if not found then
    raise exception 'no document of yours to retry' using errcode = 'no_data_found';
  end if;

  -- The job is written here rather than left to the requeue trigger.
  --
  -- That trigger fires only when the status *changes* to pending, so a document
  -- stuck at pending — which is exactly the case somebody reaches for retry to
  -- fix — would have its row updated and no job created. Doing it here covers
  -- every state the update accepts.
  insert into public.ingestion_jobs (document_id)
  values (p_document_id)
  on conflict (document_id) do update
    set run_after  = now(),
        attempts   = 0,
        last_error = null;
end;
$$;

comment on function public.retry_ingestion is
  'Sends one of the callers own documents back to pending, which the requeue '
  'trigger turns into a fresh ingestion job. security definer because status is '
  'not a client-writable column.';

-- Callable by a signed-in person only, and never by anon. The four queue
-- functions were callable by anon until 0022, so this is stated rather than
-- assumed.
revoke all on function public.retry_ingestion(uuid) from public;
revoke all on function public.retry_ingestion(uuid) from anon;
grant execute on function public.retry_ingestion(uuid) to authenticated;
