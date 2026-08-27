begin;
select plan(5);

select has_view('public', 'stuck_ingestion_jobs', 'the stuck-job view exists');
select has_view('public', 'ingestion_health', 'the health view exists');
select has_function('public', 'poke_ingestion_worker', 'the worker poke exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'drain-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('eeeeeeee-1111-1111-1111-111111111111',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'pdf', 'Drain fixture', 'hash-drain', 'fixtures/drain.pdf');

-- A fresh job is not stuck: nothing has claimed it yet.
select is(
  (select count(*)::int from public.stuck_ingestion_jobs
   where document_id = 'eeeeeeee-1111-1111-1111-111111111111'),
  0,
  'a job nobody has claimed is not reported as stuck');

-- A claimed job whose retry time has passed is exactly what an alert must see.
update public.ingestion_jobs
set attempts = 1, run_after = now() - interval '30 minutes'
where document_id = 'eeeeeeee-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.stuck_ingestion_jobs
   where document_id = 'eeeeeeee-1111-1111-1111-111111111111'),
  1,
  'a claimed job past its retry time is reported as stuck');

select * from finish();
rollback;
