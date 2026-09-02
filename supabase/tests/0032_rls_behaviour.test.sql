begin;
select plan(12);

/*
 * What the policies do, not that they exist.
 *
 * 0005_rls asserts `relrowsecurity` on eight tables — that RLS is on, never that
 * it works. Every one of those assertions passed while a signed-in user could
 * PATCH another column set entirely, because the policy was right and the grant
 * was the hole. These run as the authenticated role with a real claim.
 */

insert into auth.users (id, instance_id, aud, role, email)
values
  ('3a3a3a3a-3a3a-4a3a-8a3a-3a3a3a3a3a3a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@example.com'),
  ('3b3b3b3b-3b3b-4b3b-8b3b-3b3b3b3b3b3b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stranger@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path, expected_chunks)
values ('3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c',
        '3a3a3a3a-3a3a-4a3a-8a3a-3a3a3a3a3a3a',
        'pdf', 'the owner''s document', 'hash-rls', 'owner/x.pdf', 1);

insert into public.document_chunks (id, document_id, chunk_index, content, embedding)
values ('3d3d3d3d-3d3d-4d3d-8d3d-3d3d3d3d3d3d',
        '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c', 0, 'a private passage',
        array_fill(0.1::real, array[1024])::extensions.vector);

select public.insert_document_files(
  '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c',
  jsonb_build_array(jsonb_build_object(
    'path', 'secret.ts', 'language', 'typescript', 'lineCount', 1, 'bytes', 20,
    'content', 'export const secret = 1;')));

select public.insert_document_table(
  '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c', 'Private',
  array['Account'], jsonb_build_array(jsonb_build_object('Account', 'Northwind')));

insert into public.chats (id, user_id, title)
values ('3e3e3e3e-3e3e-4e3e-8e3e-3e3e3e3e3e3e',
        '3a3a3a3a-3a3a-4a3a-8a3a-3a3a3a3a3a3a', 'the owner''s conversation');

create temporary table owner_message as
select public.append_message(
  '3e3e3e3e-3e3e-4e3e-8e3e-3e3e3e3e3e3e', 'user', 'a private question',
  null, '{}'::uuid[], null, null, null, null, null,
  '3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f') as id;

insert into public.user_memories (user_id, content)
values ('3a3a3a3a-3a3a-4a3a-8a3a-3a3a3a3a3a3a', 'the owner prefers short answers');

-- Become the stranger. Everything below runs as them.
set local role authenticated;
set local request.jwt.claims = '{"sub": "3b3b3b3b-3b3b-4b3b-8b3b-3b3b3b3b3b3b", "role": "authenticated"}';

select is((select count(*)::int from public.documents), 0,
  'a stranger sees none of the owner''s documents');
select is((select count(*)::int from public.document_chunks), 0,
  'nor any chunk, which is where document content lives');
select is((select count(*)::int from public.document_files), 0,
  'nor any file of a repository');
select is((select count(*)::int from public.document_tables), 0,
  'nor any sheet');
select is((select count(*)::int from public.document_rows), 0,
  'nor any spreadsheet row, which is where the numbers are');
select is((select count(*)::int from public.chats), 0,
  'nor the conversation');
select is((select count(*)::int from public.messages), 0,
  'nor a message in it');
select is((select count(*)::int from public.message_parts), 0,
  'nor a message part, which is where the answer text is');
select is((select count(*)::int from public.user_memories), 0,
  'nor anything the owner asked to be remembered');

-- Retrieval must not leak either: the function is security invoker, so a stranger
-- naming the owner's document id gets nothing rather than its passages.
select is(
  (select count(*)::int from public.search_chunks(
     array['3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c']::uuid[],
     array_fill(0.1::real, array[1024])::extensions.vector,
     'private passage')),
  0,
  'search_chunks returns nothing for a document the caller cannot read');

select is(
  (select count(*)::int from public.grep_document(
     '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c', 'secret')),
  0,
  'nor does grep, which reads the file bodies');

-- And writing into somebody else's conversation is refused rather than ignored.
select throws_ok(
  $$insert into public.messages (chat_id, role) values
    ('3e3e3e3e-3e3e-4e3e-8e3e-3e3e3e3e3e3e', 'user')$$,
  null, null,
  'a stranger cannot append to the owner''s conversation');

reset role;
select * from finish();
rollback;
