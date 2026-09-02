-- Four gaps the reviews found, each one a path to a wrong state.

/*
 * 1. The count triggers covered INSERT and DELETE, not UPDATE.
 *
 * insert_document_chunks is an upsert, so a re-ingest whose rows all conflict
 * lands in the UPDATE transition tables. With no UPDATE trigger declared,
 * `inserted` was empty, array_agg returned null, unnest(null) produced no rows,
 * and the recompute was a silent no-op. The count happened to stay right because
 * a pure rewrite changes no cardinality — but the status recomputation is the
 * load-bearing half, and `update document_chunks set document_id = ...` diverges
 * both.
 */
create or replace function public.sync_document_chunk_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  -- Both transition tables, because an update touches both and either side may
  -- be the one whose count changed.
  if tg_op = 'INSERT' then
    select array_agg(distinct document_id) into ids from inserted;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct document_id) into ids from deleted;
  else
    select array_agg(distinct document_id) into ids
    from (
      select document_id from inserted
      union
      select document_id from deleted
    ) as touched;
  end if;

  update public.documents d
  set chunk_count = t.total,
      status      = case
                      when d.status = 'failed' then d.status
                      when t.total = 0 then
                        case when d.status = 'ready' then 'pending'::public.processing_status
                             else d.status end
                      when t.total >= coalesce(d.expected_chunks, t.total)
                        or exists (select 1 from public.document_files f where f.document_id = d.id)
                        then 'ready'::public.processing_status
                      else 'processing'::public.processing_status
                    end,
      indexed_at  = case when t.total > 0 then coalesce(d.indexed_at, now()) else null end
  from (
    select u.id, count(ch.id)::integer as total
    from unnest(ids) as u(id)
    left join public.document_chunks ch on ch.document_id = u.id
    group by u.id
  ) t
  where d.id = t.id;

  return null;
end;
$$;

create trigger document_chunks_sync_count_update
  after update on public.document_chunks
  referencing new table as inserted old table as deleted
  for each statement execute function public.sync_document_chunk_count();

create or replace function public.sync_document_table_row_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct table_id) into ids from inserted;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct table_id) into ids from deleted;
  else
    select array_agg(distinct table_id) into ids
    from (select table_id from inserted union select table_id from deleted) as touched;
  end if;

  update public.document_tables t
  set row_count = c.total
  from (
    select u.id, count(r.id)::integer as total
    from unnest(ids) as u(id)
    left join public.document_rows r on r.table_id = u.id
    group by u.id
  ) c
  where t.id = c.id;

  return null;
end;
$$;

create trigger document_rows_sync_count_update
  after update on public.document_rows
  referencing new table as inserted old table as deleted
  for each statement execute function public.sync_document_table_row_count();

/*
 * 2. Attaching a document to a chat checked the chat and not the document.
 *
 * The `with check` verified only that the conversation belonged to the caller, and
 * create_chat_with_documents inserted `unnest(p_document_ids)` with no validation
 * at all. So any document uuid could be attached to your own chat. Reading its
 * content was still blocked — every tool goes through security invoker functions —
 * so this was existence confirmation rather than disclosure, and it was one
 * missing clause away from being worse.
 */
drop policy chat_documents_via_chat on public.chat_documents;

create policy chat_documents_via_chat on public.chat_documents
  for all to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_documents.chat_id and c.user_id = (select auth.uid())))
  with check (
    exists (
      select 1 from public.chats c
      where c.id = chat_documents.chat_id and c.user_id = (select auth.uid()))
    and exists (
      select 1 from public.documents d
      where d.id = chat_documents.document_id and d.user_id = (select auth.uid())));

/*
 * 3. create_chat_with_documents decided ownership from a caller-supplied id.
 *
 * `coalesce(auth.uid(), (select user_id from documents where id = p_document_ids[1]))`
 * — unreachable today, because the function is security invoker and anon has no
 * insert policy on chats. But a function that reads ownership out of a parameter
 * is a hole waiting for the first caller that runs it as the service role.
 */
create or replace function public.create_chat_with_documents(
  p_title       text,
  p_document_ids uuid[]
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.chats (user_id, title)
  values ((select auth.uid()), p_title)
  returning id into new_id;

  -- The policy checks each document belongs to the caller, so a stranger's id
  -- fails here rather than being silently attached.
  insert into public.chat_documents (chat_id, document_id)
  select new_id, unnest(p_document_ids)
  on conflict do nothing;

  return new_id;
end;
$$;

/*
 * 4. The topic check admitted thirty-six dashes.
 *
 * `[0-9a-fA-F-]{36}` matches `user:------------------------------------`, and the
 * ::uuid cast then raises inside the policy on realtime.messages — which reaches
 * the client as an error rather than a denial, defeating the stated purpose of
 * the check. It fails closed, so this is error surface rather than a bypass.
 */
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
      when p_topic ~* '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(p_topic, ':', 2)::uuid = (select auth.uid())
      when p_topic ~* '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then exists (
          select 1 from public.chats c
          where c.id = split_part(p_topic, ':', 2)::uuid
            and c.user_id = (select auth.uid()))
      else false
    end,
    false);
$$;

/*
 * 5. The queue woke before the bytes existed.
 *
 * The document row is inserted, the job is enqueued, pg_net pokes the worker, and
 * only then does the client start its upload — so attempt one always raced an
 * object that was not there. Backoff is 30s * 2^attempts, so a large file on a
 * slow link could burn all five attempts before its first byte landed. The first
 * attempt now waits, which costs nothing when the upload is quick because the
 * poke on a later status change still applies.
 */
alter table public.ingestion_jobs
  alter column run_after set default now() + interval '20 seconds';

comment on column public.ingestion_jobs.run_after is
  'When this job may next be claimed. Twenty seconds after enqueue by default, '
  'because the row is created before the client uploads the bytes and attempt one '
  'used to race the object into existence.';
