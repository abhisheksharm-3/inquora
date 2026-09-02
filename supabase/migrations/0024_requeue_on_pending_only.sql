-- Requeue on `pending`, not on `failed`.
--
-- `failed` is the state the worker itself sets after five attempts. Treating it
-- as a signal to requeue meant the worker's own verdict put the job back with
-- attempts reset, so a permanently broken document got ten attempts rather than
-- five. It never looped — the second pass writes `failed` over `failed`, and the
-- trigger requires the status to change — but it doubled the cost of a document
-- that was never going to work.
--
-- `pending` is a deliberate reset: something decided this document should be
-- indexed again. That is the signal worth acting on.
drop trigger if exists documents_requeue_on_retry on public.documents;

create trigger documents_requeue_on_retry
  after update of status on public.documents
  for each row
  when (new.status = 'pending' and old.status is distinct from 'pending')
  execute function public.requeue_ingestion();

comment on function public.requeue_ingestion is
  'Puts a document back in the queue when it returns to pending. The only path '
  'back in used to be inserting the row, so a re-uploaded file matching an '
  'existing content hash could never be retried.';
