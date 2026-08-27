begin;
select plan(6);

select has_function('public', 'get_chat_context',        'get_chat_context exists');
select has_function('public', 'append_message',          'append_message exists');
select has_function('public', 'create_chat_with_documents', 'create_chat_with_documents exists');
select has_function('public', 'insert_document_chunks',  'insert_document_chunks exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('88888888-8888-8888-8888-888888888888',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rpc-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('99999999-9999-9999-9999-999999999999',
        '88888888-8888-8888-8888-888888888888',
        'pdf', 'RPC fixture', 'hash-rpc', 'fixtures/rpc.pdf');

select is(
  public.insert_document_chunks(
    '99999999-9999-9999-9999-999999999999',
    jsonb_build_array(
      jsonb_build_object('chunk_index', 0, 'content', 'alpha',
                         'embedding', (select jsonb_agg(0.1) from generate_series(1, 1024))),
      jsonb_build_object('chunk_index', 1, 'content', 'beta',
                         'embedding', (select jsonb_agg(0.2) from generate_series(1, 1024))))),
  2,
  'a whole batch of chunks is written in one call'
);

-- Two statements, not one nested call: get_chat_context is stable, so it reads
-- the snapshot taken when its query started and cannot see a chat that a
-- volatile function inserted inside the same statement. Real callers make these
-- two roundtrips anyway.
create temporary table rpc_chat as
select public.create_chat_with_documents(
         'RPC chat', array['99999999-9999-9999-9999-999999999999']::uuid[]) as id;

-- One call must return the chat, its documents, its messages and its memories.
select is(
  jsonb_typeof(public.get_chat_context((select id from rpc_chat))),
  'object',
  'get_chat_context returns a single object for the whole conversation'
);

select * from finish();
rollback;
