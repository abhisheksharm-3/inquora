begin;
select plan(5);

select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'profiles is keyed by the auth user id');

-- Inserting an auth user must produce a profile with no application involvement.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'trigger-test@example.com',
  '{"full_name": "Trigger Test"}'::jsonb
);

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'a new auth user gets exactly one profile'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Trigger Test',
  'the display name is taken from the auth metadata'
);

-- Deleting the auth user must remove the profile.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting the auth user cascades to the profile'
);

select * from finish();
rollback;
