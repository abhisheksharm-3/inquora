-- Realtime, as broadcast from the database rather than as postgres_changes.
--
-- Two reasons for broadcast. It scales: postgres_changes evaluates every
-- subscriber's row-level security against every change, so cost grows with
-- subscribers times changes. And it lets the payload be shaped — a progress
-- event carries the fraction the interface needs rather than a raw row.
--
-- Topics are `user:<uuid>` for anything about a person's own documents, and
-- `chat:<uuid>` for a conversation. Authorization is enforced by policies on
-- realtime.messages, so a private channel can only be joined by its owner.

-- Progress on a document: status moving, or another batch of chunks landing.
-- The interface shows a true fraction, which is what expected_chunks is for.
create function public.broadcast_document_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  return null;
end;
$$;

-- Only when something a watcher would act on changed. An updated_at bump on its
-- own is not an event.
create trigger documents_broadcast_progress
  after update of status, chunk_count, expected_chunks, error on public.documents
  for each row
  when (
    old.status is distinct from new.status
    or old.chunk_count is distinct from new.chunk_count
    or old.expected_chunks is distinct from new.expected_chunks
    or old.error is distinct from new.error
  )
  execute function public.broadcast_document_progress();

create trigger documents_broadcast_created
  after insert on public.documents
  for each row execute function public.broadcast_document_progress();

-- A message arriving in a conversation, so a second device follows along without
-- polling. The answer itself streams over HTTP to the client that asked; this is
-- for every other client.
create function public.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  return null;
end;
$$;

create trigger messages_broadcast
  after insert on public.messages
  for each row execute function public.broadcast_chat_message();

-- Authorization for private channels. Without these policies a client can join
-- any topic it can name.
--
-- Row-level security on realtime.messages is already on and the table belongs to
-- supabase_realtime_admin, so it is not altered here — only the policies are
-- ours, which is the documented way to authorize a private channel.

/*
 * A uuid cast on a malformed topic raises rather than returning false, which
 * inside a policy is an error the client sees. This checks the shape first.
 */
create function public.topic_owner_matches(p_topic text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_topic ~ '^user:[0-9a-fA-F-]{36}$'
      then split_part(p_topic, ':', 2)::uuid = (select auth.uid())
    when p_topic ~ '^chat:[0-9a-fA-F-]{36}$'
      then exists (
        select 1 from public.chats c
        where c.id = split_part(p_topic, ':', 2)::uuid
          and c.user_id = (select auth.uid()))
    else false
  end;
$$;

comment on function public.topic_owner_matches is
  'Whether the calling user owns the realtime topic being joined. Used by the '
  'policies on realtime.messages, which is what makes a private channel private.';

create policy realtime_receive_own_topics on realtime.messages
  for select to authenticated
  using (public.topic_owner_matches(realtime.topic()));

-- Clients may also send on their own topics, which is what a presence or a
-- typing indicator needs. Writing to somebody else's topic stays impossible.
create policy realtime_send_own_topics on realtime.messages
  for insert to authenticated
  with check (public.topic_owner_matches(realtime.topic()));
