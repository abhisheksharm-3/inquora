begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email)
values ('2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delete-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path, expected_chunks)
values ('2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b',
        '2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
        'pdf', 'a cited document', 'hash-delete', 'delete/x.pdf', 1);

insert into public.document_chunks (id, document_id, chunk_index, content, embedding)
values ('2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c',
        '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b', 0, 'the passage',
        array_fill(0.1::real, array[1024])::extensions.vector);

insert into public.chats (id, user_id, title)
values ('2d2d2d2d-2d2d-4d2d-8d2d-2d2d2d2d2d2d',
        '2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a', 'cited');

-- An answer that cites it, which is the ordinary case.
create temporary table answered as
select public.append_message(
  '2d2d2d2d-2d2d-4d2d-8d2d-2d2d2d2d2d2d', 'assistant', 'The passage says so.',
  null, array['2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c']::uuid[]) as id;

select is(
  (select count(*)::int from public.message_parts
   where message_id = (select id from answered) and kind = 'source'),
  1,
  'the answer carries a source part');

-- This used to fail with message_parts_shape, so a cited document was permanent.
select lives_ok(
  $$delete from public.documents where id = '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b'$$,
  'a document that has been cited can be deleted');

select is(
  (select count(*)::int from public.message_parts
   where message_id = (select id from answered) and kind = 'source'),
  0,
  'its citation goes with it');

-- And the answer itself survives, so the conversation still reads.
select is(
  (select text from public.message_parts
   where message_id = (select id from answered) and kind = 'text'),
  'The passage says so.',
  'the answer text is untouched');

select * from finish();
rollback;
