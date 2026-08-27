begin;
select plan(8);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.documents'::regclass),
  'RLS is enabled on documents');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.document_chunks'::regclass),
  'RLS is enabled on document_chunks');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.chats'::regclass),
  'RLS is enabled on chats');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.chat_documents'::regclass),
  'RLS is enabled on chat_documents');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'RLS is enabled on messages');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.message_parts'::regclass),
  'RLS is enabled on message_parts');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_memories'::regclass),
  'RLS is enabled on user_memories');

select * from finish();
rollback;
