begin;
select plan(5);

select has_function('public', 'read_document_transcript', 'read_document_transcript exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('f1f1f1f1-f1f1-4ff1-8ff1-f1f1f1f1f1f1',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'lookup-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, source_url)
values ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2',
        'f1f1f1f1-f1f1-4ff1-8ff1-f1f1f1f1f1f1',
        'video', 'a recorded review', 'hash-video', 'https://example.com/video');

insert into public.document_chunks (document_id, chunk_index, content, embedding, metadata)
values
  ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 0, 'Welcome to the quarterly review.',
   array_fill(0.1::real, array[1024])::extensions.vector,
   '{"startSeconds": 0, "endSeconds": 30}'::jsonb),
  ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 1, 'Revenue came in under forecast.',
   array_fill(0.2::real, array[1024])::extensions.vector,
   '{"startSeconds": 31, "endSeconds": 75}'::jsonb),
  ('f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 2, 'Questions at the end please.',
   array_fill(0.3::real, array[1024])::extensions.vector,
   '{"startSeconds": 130, "endSeconds": 180}'::jsonb);

select is(
  (select count(*)::int from public.read_document_transcript(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 0, 100)),
  2,
  'the segments within the window come back, and no others');

-- A segment straddling the start of the window must not be skipped, or the
-- sentence a citation points at is lost.
select is(
  (select count(*)::int from public.read_document_transcript(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 60, 70)),
  1,
  'a window inside one segment returns that segment rather than nothing');

select is(
  (select start_s from public.read_document_transcript(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 120, 200)),
  130,
  'the timestamps come back, which is what makes a citation a deep link');

select is(
  (select count(*)::int from public.read_document_transcript(
     'f2f2f2f2-f2f2-4ff2-8ff2-f2f2f2f2f2f2', 500, 600)),
  0,
  'a window with nothing in it returns nothing rather than everything');

select * from finish();
rollback;
