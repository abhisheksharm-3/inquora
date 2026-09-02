begin;
select plan(5);

select has_function('public', 'read_document_file', 'read_document_file exists');
select has_function('public', 'read_document_transcript', 'read_document_transcript exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('f1f1f1f1-f1f1-4ff1-8ff1-f1f1f1f1f1f1',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'lookup-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, source_url)
values ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2',
        'f1f1f1f1-f1f1-4ff1-8ff1-f1f1f1f1f1f1',
        'github', 'a repository', 'hash-repo', 'https://github.com/owner/name');

insert into public.document_chunks (document_id, chunk_index, content, embedding, metadata)
values
  ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 0, 'export function first() {}',
   array_fill(0.1::real, array[1024])::extensions.vector,
   '{"path": "src/a.ts", "fromLine": 1, "toLine": 30}'::jsonb),
  ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 1, 'export function second() {}',
   array_fill(0.2::real, array[1024])::extensions.vector,
   '{"path": "src/a.ts", "fromLine": 31, "toLine": 60}'::jsonb),
  ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 2, 'unrelated file',
   array_fill(0.3::real, array[1024])::extensions.vector,
   '{"path": "src/b.ts", "fromLine": 1, "toLine": 10}'::jsonb);

select is(
  (select count(*)::int from public.read_document_file(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 'src/a.ts', 1, 100)),
  2,
  'both chunks of the requested file come back, and no others');

-- A chunk straddling the start of the range must not be skipped.
select is(
  (select count(*)::int from public.read_document_file(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 'src/a.ts', 25, 35)),
  2,
  'a range overlapping two chunks returns both rather than neither');

select is(
  (select count(*)::int from public.read_document_file(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 'src/missing.ts', 1, 100)),
  0,
  'a path that is not in the document returns nothing rather than everything');

select * from finish();
rollback;
