begin;
select plan(6);

select has_column('public', 'messages', 'client_message_id', 'a message can carry the sender''s id');

insert into auth.users (id, instance_id, aud, role, email)
values ('1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'idem-test@example.com');

insert into public.chats (id, user_id, title)
values ('1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b',
        '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a', 'idempotency');

insert into public.chats (id, user_id, title)
values ('1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c',
        '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a', 'another conversation');

-- The same send twice must resolve to one message.
create temporary table sent as
select public.append_message(
  '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b', 'user', 'why did revenue miss?',
  null, '{}'::uuid[], null, null, null, null, null,
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d') as id;

select is(
  public.append_message(
    '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b', 'user', 'why did revenue miss?',
    null, '{}'::uuid[], null, null, null, null, null,
    '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'),
  (select id from sent),
  'the same sender id returns the first message rather than writing a second');

select is(
  (select count(*)::int from public.messages
   where chat_id = '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b'),
  1,
  'and the conversation holds one message, not two');

-- Nor does it duplicate the parts, which would double the answer on replay.
select is(
  (select count(*)::int from public.message_parts where message_id = (select id from sent)),
  1,
  'the parts are not written twice either');

-- A different sender id is a different message.
select isnt(
  public.append_message(
    '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b', 'user', 'and Q4?',
    null, '{}'::uuid[], null, null, null, null, null,
    '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'),
  (select id from sent),
  'a new sender id is a new message');

-- A branch may not start from a message in another conversation.
select throws_ok(
  format(
    $$select public.append_message(
        '1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c', 'user', 'grafted',
        %L, '{}'::uuid[], null, null, null, null, null,
        '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f')$$,
    (select id from sent)),
  null, null,
  'a parent from another chat is refused rather than silently grafted');

select * from finish();
rollback;
