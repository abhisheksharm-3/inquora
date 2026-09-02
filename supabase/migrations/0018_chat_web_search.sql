-- Web search is off by default and per conversation.
--
-- The product's claim is that an answer comes from your documents. Reaching the
-- open web changes what an answer means, so it is a decision the user makes per
-- conversation rather than a capability that is quietly always on.
alter table public.chats
  add column if not exists web_search boolean not null default false;

comment on column public.chats.web_search is
  'Whether this conversation may search the web. Default false: an answer from the '
  'open web is a different kind of answer, and citations from it are marked as such.';

-- get_chat_context has to carry the flag, or the agent cannot honour it.
create or replace function public.get_chat_context(
  p_chat_id       uuid,
  p_history_limit integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'chat', jsonb_build_object(
      'id', c.id, 'title', c.title,
      'webSearch', c.web_search,
      'createdAt', c.created_at, 'updatedAt', c.updated_at),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'kind', d.kind, 'title', d.title,
               'status', d.status, 'chunkCount', d.chunk_count)
             order by cd.position, cd.added_at)
      from public.chat_documents cd
      join public.documents d on d.id = cd.document_id
      where cd.chat_id = c.id and cd.enabled
      ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'role', m.role, 'parentId', m.parent_id,
               'createdAt', m.created_at,
               'parts', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'kind', mp.kind, 'text', mp.text,
                          'toolCallId', mp.tool_call_id, 'toolName', mp.tool_name,
                          'toolArgs', mp.tool_args, 'toolResult', mp.tool_result,
                          'chunkId', mp.chunk_id)
                        order by mp.position)
                 from public.message_parts mp
                 where mp.message_id = m.id), '[]'::jsonb))
             order by m.created_at)
      from (
        select * from public.messages
        where chat_id = c.id
        order by created_at desc
        limit p_history_limit
      ) m), '[]'::jsonb),
    'memories', coalesce((
      select jsonb_agg(um.content order by um.created_at)
      from public.user_memories um
      where um.user_id = c.user_id), '[]'::jsonb),
    'profile', jsonb_build_object(
      'displayName', (select p.display_name from public.profiles p where p.id = c.user_id))
  )
  from public.chats c
  where c.id = p_chat_id;
$$;

comment on function public.get_chat_context is
  'The whole conversation in one call: the chat and its web-search setting, its '
  'enabled documents in rail order, its recent messages with their parts, the '
  'user memories and the profile. Replaces six sequential reads.';
