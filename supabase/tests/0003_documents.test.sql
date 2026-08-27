begin;
select plan(6);

select has_table('public', 'documents', 'documents table exists');
select has_table('public', 'document_chunks', 'document_chunks table exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'doc-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'pdf', 'Fixture', 'hash-a', 'fixtures/a.pdf');

select is(
  (select status::text from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  'pending',
  'a new document starts pending'
);

insert into public.document_chunks (document_id, chunk_index, content, embedding)
values
  ('33333333-3333-3333-3333-333333333333', 0, 'the first chunk', array_fill(0.1::real, array[1024])::extensions.vector),
  ('33333333-3333-3333-3333-333333333333', 1, 'the second chunk', array_fill(0.2::real, array[1024])::extensions.vector);

select is(
  (select chunk_count from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  2,
  'chunk_count is maintained by the database, not by the application'
);

select is(
  (select status::text from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  'ready',
  'a document with chunks becomes ready without an application write'
);

delete from public.document_chunks where document_id = '33333333-3333-3333-3333-333333333333';

select is(
  (select chunk_count from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  0,
  'deleting chunks decrements the count'
);

select * from finish();
rollback;
