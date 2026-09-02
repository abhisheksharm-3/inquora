begin;
select plan(8);

select has_table('public', 'document_files', 'files are rows');
select has_function('public', 'insert_document_files', 'files are written in one call per batch');

insert into auth.users (id, instance_id, aud, role, email)
values ('a1a1a1a1-a1a1-4aa1-8aa1-a1a1a1a1a1a1',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'files-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, source_url)
values ('a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2',
        'a1a1a1a1-a1a1-4aa1-8aa1-a1a1a1a1a1a1',
        'github', 'a repository', 'hash-files', 'https://github.com/owner/name');

select is(
  public.insert_document_files(
    'a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2',
    jsonb_build_array(
      jsonb_build_object(
        'path', 'src/queue.ts', 'language', 'typescript', 'lineCount', 4, 'bytes', 120,
        'content', E'import { claim } from "./db";\n\nexport function drain() {\n  return claim_ingestion_job();\n}'),
      jsonb_build_object(
        'path', 'README.md', 'language', 'markdown', 'lineCount', 2, 'bytes', 40,
        'content', E'# Inquora\nChat with your documents.'))),
  2,
  'a batch of files is written in one statement');

-- The question a truncated text column answered badly: which file, which line.
select is(
  (select path from public.grep_document(
     'a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2', 'claim_ingestion_job')),
  'src/queue.ts',
  'a match reports the file it came from');

select is(
  (select line_number from public.grep_document(
     'a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2', 'claim_ingestion_job')),
  4,
  'and the line within that file');

-- read_file returns the real lines, not the chunk that overlapped them.
select is(
  (select content from public.read_document_file(
     'a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2', 'src/queue.ts', 3, 3)),
  'export function drain() {',
  'a one-line range returns exactly that line');

select is(
  (select line_count from public.read_document_file(
     'a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2', 'src/queue.ts', 1, 400)),
  4,
  'the file length comes back, so a reader knows whether it saw all of it');

-- Re-ingesting replaces a file rather than duplicating it.
select is(
  public.insert_document_files(
    'a2a2a2a2-a2a2-4aa2-8aa2-a2a2a2a2a2a2',
    jsonb_build_array(
      jsonb_build_object(
        'path', 'src/queue.ts', 'language', 'typescript', 'lineCount', 1, 'bytes', 10,
        'content', 'export {};'))),
  1,
  're-ingesting a path replaces it');

select * from finish();
rollback;
