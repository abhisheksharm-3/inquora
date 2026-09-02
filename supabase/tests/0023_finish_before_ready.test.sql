begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email)
values ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ready-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path, expected_chunks)
values ('0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d',
        '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c',
        'pdf', 'a long document', 'hash-ready', 'ready/x.pdf', 4);

-- One batch of a four-chunk document. The defect: this used to read `ready`.
insert into public.document_chunks (document_id, chunk_index, content, embedding)
values ('0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d', 0, 'first',
        array_fill(0.1::real, array[1024])::extensions.vector);

select is(
  (select status::text from public.documents where id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  'processing',
  'one chunk of four is processing, not ready');

-- And the job must still be there, or nothing can resume it.
select is(
  (select count(*)::int from public.ingestion_jobs
   where document_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  1,
  'the queue row survives a partial ingestion');

insert into public.document_chunks (document_id, chunk_index, content, embedding)
values
  ('0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d', 1, 'second', array_fill(0.2::real, array[1024])::extensions.vector),
  ('0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d', 2, 'third',  array_fill(0.3::real, array[1024])::extensions.vector),
  ('0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d', 3, 'fourth', array_fill(0.4::real, array[1024])::extensions.vector);

select is(
  (select status::text from public.documents where id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  'ready',
  'the last expected chunk makes it ready');

select is(
  (select count(*)::int from public.ingestion_jobs
   where document_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  0,
  'and the finished document keeps no job');

-- A repository is ready once its files are stored, because grep and read_file
-- already answer from them.
insert into public.documents (id, user_id, kind, title, content_hash, source_url, expected_chunks)
values ('0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e',
        '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c',
        'github', 'a repository', 'hash-repo-ready', 'https://github.com/owner/name', 500);

select public.insert_document_files(
  '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e',
  jsonb_build_array(jsonb_build_object(
    'path', 'src/a.ts', 'language', 'typescript', 'lineCount', 1, 'bytes', 10,
    'content', 'export {};')));

insert into public.document_chunks (document_id, chunk_index, content, embedding)
values ('0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e', 0, 'summary',
        array_fill(0.5::real, array[1024])::extensions.vector);

select is(
  (select status::text from public.documents where id = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'),
  'ready',
  'a repository with files stored is ready before every summary is embedded');

-- Failing a job that no longer exists must raise rather than pretend.
select throws_ok(
  $$select public.fail_ingestion_job(999999999, 'nothing to fail')$$,
  null, null,
  'failing a job that is gone raises rather than silently doing nothing');

-- A document put back to pending returns to the queue. `failed` deliberately does
-- not: that is the worker's own verdict, and requeueing on it doubled the
-- attempts a broken document costs.
update public.documents set status = 'failed'
where id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d';

select is(
  (select count(*)::int from public.ingestion_jobs
   where document_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  0,
  'the worker''s own failure verdict does not requeue the job');

update public.documents set status = 'pending'
where id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d';

select is(
  (select count(*)::int from public.ingestion_jobs
   where document_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  1,
  'a document that fails is queued again, so a retry is possible at all');

select is(
  (select attempts from public.ingestion_jobs
   where document_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'),
  0,
  'and its attempts start over');

-- The embedding survives the round trip through pgvector's own text format.
select is(
  public.insert_document_chunks(
    '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d',
    jsonb_build_array(jsonb_build_object(
      'chunk_index', 9, 'content', 'ordered',
      'embedding', (select jsonb_agg(0.25) from generate_series(1, 1024))))),
  1,
  'a chunk written from a jsonb embedding lands exactly once');

select * from finish();
rollback;
