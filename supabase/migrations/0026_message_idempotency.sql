-- A retried send must not be answered twice.
--
-- POST /api/chats/[chatId]/messages had no idempotency key, so a double-click, a
-- client retry after a stalled stream, or any retrying proxy produced two
-- messages rows with the same content and the same parent — siblings, so not even
-- visibly duplicated in a branch UI — and two complete agent runs, each at
-- minimum two model turns plus embedding calls. The only ceiling was thirty a
-- minute. Uploads were already idempotent by content hash and
-- insert_document_chunks by (document_id, chunk_index); the one path that spends
-- money on every call was the one left open.
--
-- The client supplies the id, because only the client knows that its second
-- request is a retry of its first rather than a new question.

alter table public.messages
  add column if not exists client_message_id uuid;

comment on column public.messages.client_message_id is
  'The sender''s own id for this message. Unique per chat, so a retry resolves to '
  'the first attempt rather than to a second answer.';

-- Partial, because only user messages carry one: an assistant message is written
-- by the server, which does not retry itself.
create unique index if not exists messages_chat_client_id_key
  on public.messages (chat_id, client_message_id)
  where client_message_id is not null;

/*
 * append_message, with the sender's id.
 *
 * On a repeat it returns the id of the first attempt rather than inserting, so
 * the caller can tell the difference between "stored" and "already stored" by
 * comparing what it gets back with what it asked for. A parent from another chat
 * is refused: nothing checked that before, so a caller could graft a branch
 * across conversations and leave a message tree the UI cannot walk.
 */
create or replace function public.append_message(
  p_chat_id            uuid,
  p_role               public.message_role,
  p_content            text,
  p_parent_id          uuid    default null,
  p_citation_chunk_ids uuid[] default '{}'::uuid[],
  p_tokens_in          integer default null,
  p_tokens_out         integer default null,
  p_latency_ms         integer default null,
  p_retrieval_ms       integer default null,
  p_model              text    default null,
  p_client_message_id  uuid    default null
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
  if p_parent_id is not null
     and not exists (
       select 1 from public.messages
       where id = p_parent_id and chat_id = p_chat_id
     ) then
    raise exception 'parent message % is not in chat %', p_parent_id, p_chat_id
      using errcode = 'foreign_key_violation',
            hint = 'a branch cannot start from a message in another conversation';
  end if;

  if p_client_message_id is not null then
    select id into new_id
    from public.messages
    where chat_id = p_chat_id and client_message_id = p_client_message_id;

    -- Already sent. The first attempt's id comes back and nothing is written.
    if new_id is not null then
      return new_id;
    end if;
  end if;

  insert into public.messages
    (chat_id, parent_id, role, tokens_in, tokens_out, latency_ms, retrieval_ms, model,
     client_message_id)
  values
    (p_chat_id, p_parent_id, p_role, p_tokens_in, p_tokens_out, p_latency_ms, p_retrieval_ms,
     p_model, p_client_message_id)
  returning id into new_id;

  -- The answer text is part zero; each cited chunk follows as a source part, so
  -- a reload replays the message exactly as it streamed.
  insert into public.message_parts (message_id, position, kind, text)
  values (new_id, 0, 'text', p_content);

  if array_length(p_citation_chunk_ids, 1) is not null then
    insert into public.message_parts (message_id, position, kind, chunk_id)
    select new_id, ordinality::integer, 'source', chunk_id
    from unnest(p_citation_chunk_ids) with ordinality as t(chunk_id, ordinality);
  end if;

  return new_id;
end;
$$;
