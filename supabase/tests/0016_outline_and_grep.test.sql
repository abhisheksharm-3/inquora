begin;
select plan(6);

select has_column('public', 'documents', 'outline', 'documents carry an outline');
select has_column('public', 'documents', 'extracted_text', 'documents keep their text');
select has_function('public', 'grep_document', 'grep_document exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('d0d0d0d0-d0d0-4dd0-8dd0-d0d0d0d0d0d0',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'grep-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path, extracted_text)
values ('e0e0e0e0-e0e0-4ee0-8ee0-e0e0e0e0e0e0',
        'd0d0d0d0-d0d0-4dd0-8dd0-d0d0d0d0d0d0',
        'doc', 'Incident report', 'hash-grep', 'fixtures/incident.md',
        E'The queue stopped draining at 02:11 UTC.\nThe cause was error PG-4711 in a trigger.\nTime to detection was eleven days.\nNo alert fired.');

-- The case embeddings are worst at: an exact identifier.
select is(
  (select line_number from public.grep_document(
     'e0e0e0e0-e0e0-4ee0-8ee0-e0e0e0e0e0e0', 'PG-4711')),
  2,
  'a literal error code is found on its own line');

select is(
  (select count(*)::int from public.grep_document(
     'e0e0e0e0-e0e0-4ee0-8ee0-e0e0e0e0e0e0', 'queue|alert')),
  2,
  'a regex alternation matches both lines');

select is(
  (select count(*)::int from public.grep_document(
     'e0e0e0e0-e0e0-4ee0-8ee0-e0e0e0e0e0e0', 'pg-4711')),
  1,
  'matching is case-insensitive, because prose does not case an identifier the way code does');

select * from finish();
rollback;
