alter table public.profiles          enable row level security;
alter table public.documents         enable row level security;
alter table public.document_chunks   enable row level security;
alter table public.chats             enable row level security;
alter table public.chat_documents    enable row level security;
alter table public.messages          enable row level security;
alter table public.message_parts     enable row level security;
alter table public.user_memories     enable row level security;

-- auth.uid() is wrapped in a subselect throughout so Postgres hoists it into an
-- InitPlan and evaluates it once per query rather than once per row.

create policy profiles_owner on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy documents_owner on public.documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy chats_owner on public.chats
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_memories_owner on public.user_memories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Child tables carry no user_id; they inherit ownership through their parent.

create policy document_chunks_via_document on public.document_chunks
  for all to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_chunks.document_id and d.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_chunks.document_id and d.user_id = (select auth.uid())));

create policy chat_documents_via_chat on public.chat_documents
  for all to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_documents.chat_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.chats c
    where c.id = chat_documents.chat_id and c.user_id = (select auth.uid())));

create policy messages_via_chat on public.messages
  for all to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = messages.chat_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.chats c
    where c.id = messages.chat_id and c.user_id = (select auth.uid())));

create policy message_parts_via_message on public.message_parts
  for all to authenticated
  using (exists (
    select 1
    from public.messages m
    join public.chats c on c.id = m.chat_id
    where m.id = message_parts.message_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1
    from public.messages m
    join public.chats c on c.id = m.chat_id
    where m.id = message_parts.message_id and c.user_id = (select auth.uid())));
