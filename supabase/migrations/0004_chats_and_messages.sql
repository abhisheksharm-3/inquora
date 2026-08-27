create table public.chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- History is ordered by last activity, which is what a user means by "recent".
create index chats_user_updated_idx on public.chats (user_id, updated_at desc);

create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function extensions.moddatetime (updated_at);

-- The join that makes several documents in one chat an array parameter rather
-- than a rebuild.
-- position orders the document rail in the UI. enabled is the per-chat toggle
-- for "search only these two of my five", which is a scope change rather than
-- removing the document from the conversation.
create table public.chat_documents (
  chat_id     uuid not null references public.chats (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  position    integer not null default 0,
  enabled     boolean not null default true,
  added_at    timestamptz not null default now(),
  primary key (chat_id, document_id)
);

create index chat_documents_document_idx on public.chat_documents (document_id);

-- parent_id makes the conversation a tree rather than a list, which is what
-- message editing and branch navigation require. assistant-ui ships BranchPicker
-- as a built-in; without a parent pointer it has nothing to walk.
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references public.chats (id) on delete cascade,
  parent_id     uuid references public.messages (id) on delete cascade,
  role          public.message_role not null,
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  retrieval_ms  integer,
  model         text,
  created_at    timestamptz not null default now()
);

create index messages_chat_created_idx on public.messages (chat_id, created_at);
create index messages_chat_parent_idx  on public.messages (chat_id, parent_id);

-- A message is an ordered list of parts, not a string. This is how both
-- LangGraph and assistant-ui model one, and it is what lets a tool call and its
-- result survive a page reload: a conversation replayed without them loses the
-- reason an answer said what it said.
--
-- The source kind absorbs what was going to be a separate citations table.
create table public.message_parts (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages (id) on delete cascade,
  position     integer not null,
  kind         public.message_part_kind not null,

  text         text,    -- text, reasoning
  tool_call_id text,    -- tool_call, tool_result
  tool_name    text,    -- tool_call, tool_result
  tool_args    jsonb,   -- tool_call
  tool_result  jsonb,   -- tool_result
  chunk_id     uuid references public.document_chunks (id) on delete set null,  -- source

  created_at   timestamptz not null default now(),

  constraint message_parts_shape check (
    case kind
      when 'text'        then text is not null
      when 'reasoning'   then text is not null
      when 'tool_call'   then tool_call_id is not null and tool_name is not null
      when 'tool_result' then tool_call_id is not null
      when 'source'      then chunk_id is not null
    end
  )
);

create unique index message_parts_message_position_key
  on public.message_parts (message_id, position);

create index message_parts_chunk_idx on public.message_parts (chunk_id)
  where kind = 'source';

create function public.touch_chat_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return null;
end;
$$;

create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_on_message();

-- The old user_memories.user_id had no foreign key at all.
create table public.user_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_memories_user_idx on public.user_memories (user_id);

create trigger user_memories_set_updated_at
  before update on public.user_memories
  for each row execute function extensions.moddatetime (updated_at);
