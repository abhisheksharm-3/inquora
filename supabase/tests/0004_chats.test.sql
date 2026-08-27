begin;
select plan(6);

select has_table('public', 'chat_documents', 'the chat-to-document join exists');
select has_column('public', 'messages', 'parent_id',
  'messages form a tree, so a branch can be edited and regenerated');
select has_table('public', 'message_parts',
  'a message is an ordered list of parts, not a string');
select hasnt_column('public', 'chats', 'file_id', 'chats no longer holds a single file');
select hasnt_column('public', 'chats', 'type', 'chats no longer duplicates the document kind');

insert into auth.users (id, instance_id, aud, role, email)
values ('44444444-4444-4444-4444-444444444444',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'chat-test@example.com');

insert into public.chats (id, user_id, title)
values ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444', 'Fixture chat');

-- updated_at must move when a message arrives, or history sorts by creation and
-- an actively used old chat sinks to the bottom.
update public.chats
set updated_at = now() - interval '10 days'
where id = '55555555-5555-5555-5555-555555555555';

insert into public.messages (chat_id, role)
values ('55555555-5555-5555-5555-555555555555', 'user');

select ok(
  (select updated_at from public.chats where id = '55555555-5555-5555-5555-555555555555')
    > now() - interval '1 minute',
  'a new message bumps the chat updated_at'
);

select * from finish();
rollback;
