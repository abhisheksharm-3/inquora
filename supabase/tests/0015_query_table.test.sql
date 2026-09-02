begin;
select plan(14);

select has_table('public', 'document_tables', 'the sheet table exists');
select has_table('public', 'document_rows', 'the row table exists');
select has_function('public', 'query_document_table', 'the query function exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('cafecafe-cafe-4afe-8afe-cafecafecafe',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'sheet-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('beefbeef-beef-4eef-8eef-beefbeefbeef',
        'cafecafe-cafe-4afe-8afe-cafecafecafe',
        'sheet', 'Q3 pipeline', 'hash-sheet', 'fixtures/pipeline.xlsx');

select ok(
  public.insert_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef',
    'Pipeline',
    array['Account', 'Stage', 'Value'],
    jsonb_build_array(
      jsonb_build_object('Account', 'Northwind', 'Stage', 'Closed won',  'Value', '48000'),
      jsonb_build_object('Account', 'Acme',      'Stage', 'Proposal',    'Value', '31000'),
      jsonb_build_object('Account', 'Globex',    'Stage', 'Closed lost', 'Value', '22000'))
  ) is not null,
  'a sheet is written in one call');

select is(
  (select row_count from public.document_tables
   where document_id = 'beefbeef-beef-4eef-8eef-beefbeefbeef'),
  3,
  'the row count is maintained by the database');

-- The question a chunked spreadsheet cannot answer.
select is(
  public.query_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef',
    'Pipeline',
    'select "Account" from t where "Value"::numeric > 25000 order by "Value"::numeric desc'),
  '[{"Account": "Northwind"}, {"Account": "Acme"}]'::jsonb,
  'a numeric comparison across rows returns the right accounts');

select is(
  public.query_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef',
    'Pipeline',
    'select sum("Value"::numeric) as total from t'),
  '[{"total": 101000}]'::jsonb,
  'an aggregate over the sheet is exact rather than estimated');

select throws_ok(
  $$select public.query_document_table(
      'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Pipeline',
      'delete from public.document_rows')$$,
  null,
  null,
  'a write is refused');

select throws_ok(
  $$select public.query_document_table(
      'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Pipeline',
      'select 1; drop table public.documents')$$,
  null,
  null,
  'a second statement smuggled in behind a semicolon is refused');

-- The columns that used to make a sheet permanently unqueryable.
select public.insert_document_table(
  'beefbeef-beef-4eef-8eef-beefbeefbeef',
  'Awkward',
  array['Account', 'Created', 'Updated', 'Comments', 'Call Count'],
  jsonb_build_array(
    jsonb_build_object('Account', 'Northwind', 'Created', '2026-01-01',
                       'Updated', '2026-03-01', 'Comments', 'renewed',
                       'Call Count', '4'),
    jsonb_build_object('Account', 'Acme', 'Created', '2026-02-01',
                       'Updated', '2026-02-15', 'Comments', 'no answer',
                       'Call Count', '9')));

select is(
  public.query_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Awkward',
    'select "Account" from t where "Updated" > ''2026-02-20'''),
  '[{"Account": "Northwind"}]'::jsonb,
  'a column called Updated is a column, not the verb update');

select is(
  public.query_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Awkward',
    'select sum("Call Count"::numeric) as calls from t'),
  '[{"calls": 13}]'::jsonb,
  'and one called Call Count is not the verb call');

select is(
  public.query_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Awkward',
    'select "Comments" from t where "Created" = ''2026-02-01'''),
  '[{"Comments": "no answer"}]'::jsonb,
  'Comments and Created are columns too');

-- A literal may say anything, because literals are blanked before the check.
select is(
  public.query_document_table(
    'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Awkward',
    'select "Account" from t where "Comments" = ''delete everything'''),
  '[]'::jsonb,
  'a cell value that reads like a verb is still just a value');

-- And the check that closes the class: no function may be called.
select throws_ok(
  $$select public.query_document_table(
      'beefbeef-beef-4eef-8eef-beefbeefbeef', 'Awkward',
      'select public.fail_ingestion_job(1, ''x'') from t')$$,
  null, null,
  'a query may not call a function, whatever it is named');


select * from finish();
rollback;
