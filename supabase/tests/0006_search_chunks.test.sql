begin;
select plan(3);

select has_function('public', 'search_chunks', 'search_chunks exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('66666666-6666-6666-6666-666666666666',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'search-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('77777777-7777-7777-7777-777777777777',
        '66666666-6666-6666-6666-666666666666',
        'pdf', 'Search fixture', 'hash-search', 'fixtures/search.pdf');

-- Two chunks with distinguishable vectors and distinguishable words.
insert into public.document_chunks (document_id, chunk_index, content, embedding)
values
  ('77777777-7777-7777-7777-777777777777', 0,
   'the quarterly revenue report for the northern region',
   array_fill(0.9::real, array[1024])::extensions.vector),
  ('77777777-7777-7777-7777-777777777777', 1,
   'the onboarding checklist for new engineers',
   array_fill(0.1::real, array[1024])::extensions.vector);

select is(
  (select count(*)::int
   from public.search_chunks(
     array['77777777-7777-7777-7777-777777777777']::uuid[],
     array_fill(0.9::real, array[1024])::extensions.vector,
     'quarterly revenue')),
  2,
  'both chunks are returned, ranked'
);

-- The lexical arm must lift the chunk containing the literal words even though
-- both chunks are in range of the vector.
select is(
  (select content
   from public.search_chunks(
     array['77777777-7777-7777-7777-777777777777']::uuid[],
     array_fill(0.5::real, array[1024])::extensions.vector,
     'onboarding checklist engineers')
   limit 1),
  'the onboarding checklist for new engineers',
  'the lexical arm ranks an exact term match first'
);

select * from finish();
rollback;
