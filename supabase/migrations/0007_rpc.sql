-- Replaces the six sequential Supabase roundtrips the old send path made before
-- any thinking started: chat, files, users, user_memories, recent chats, and a
-- second files read inside getFileContent.
create function public.get_chat_context(
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
      'createdAt', c.created_at, 'updatedAt', c.updated_at),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'kind', d.kind, 'title', d.title,
               'status', d.status, 'chunkCount', d.chunk_count)
             order by cd.added_at)
      from public.chat_documents cd
      join public.documents d on d.id = cd.document_id
      where cd.chat_id = c.id), '[]'::jsonb),
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

-- Message and citations written together, so an answer can never be persisted
-- without the passages it stood on.
create function public.append_message(
  p_chat_id            uuid,
  p_role               public.message_role,
  p_content            text,
  p_parent_id          uuid    default null,
  p_citation_chunk_ids uuid[] default '{}'::uuid[],
  p_tokens_in          integer default null,
  p_tokens_out         integer default null,
  p_latency_ms         integer default null,
  p_retrieval_ms       integer default null,
  p_model              text    default null
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
  insert into public.messages
    (chat_id, parent_id, role, tokens_in, tokens_out, latency_ms, retrieval_ms, model)
  values
    (p_chat_id, p_parent_id, p_role, p_tokens_in, p_tokens_out, p_latency_ms, p_retrieval_ms, p_model)
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

create function public.create_chat_with_documents(
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
  values (coalesce((select auth.uid()),
                   (select user_id from public.documents
                    where id = p_document_ids[1])),
          p_title)
  returning id into new_id;

  insert into public.chat_documents (chat_id, document_id)
  select new_id, unnest(p_document_ids)
  on conflict do nothing;

  return new_id;
end;
$$;

-- One statement per batch, replacing the old five-chunks-then-sleep-five-seconds
-- loop that spent roughly eight minutes idle on a five-hundred-chunk document.
create function public.insert_document_chunks(
  p_document_id uuid,
  p_chunks      jsonb
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with inserted as (
    insert into public.document_chunks
      (document_id, chunk_index, content, embedding, token_count, metadata)
    select
      p_document_id,
      (c ->> 'chunk_index')::integer,
      c ->> 'content',
      (select array_agg(value::text::real) from jsonb_array_elements(c -> 'embedding'))
        ::extensions.vector(1024),
      nullif(c ->> 'token_count', '')::integer,
      coalesce(c -> 'metadata', '{}'::jsonb)
    from jsonb_array_elements(p_chunks) as c
    on conflict (document_id, chunk_index) do update
      set content     = excluded.content,
          embedding   = excluded.embedding,
          token_count = excluded.token_count,
          metadata    = excluded.metadata
    returning 1
  )
  select count(*)::integer from inserted;
$$;
