-- Spreadsheets as tables, not as prose.
--
-- Chunking a workbook into text makes it searchable and leaves it unqueryable:
-- "what was Acme's stage" can be answered from a chunk, "which accounts are over
-- 40,000" cannot, because the numbers are inside a sentence. The old extractor
-- flattened a workbook into `=== Sheet: name ===` and embedded it, which
-- destroys columns, types and row identity.
--
-- Rows are stored as jsonb keyed by the header, so a sheet keeps its own column
-- names without a migration per document.

create table public.document_tables (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  name        text not null,
  /** Column names in sheet order, which is what a query is written against. */
  header      text[] not null,
  row_count   integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint document_tables_header_not_empty check (cardinality(header) > 0)
);

create unique index document_tables_document_name_key
  on public.document_tables (document_id, name);

create table public.document_rows (
  id        bigserial primary key,
  table_id  uuid not null references public.document_tables (id) on delete cascade,
  row_index integer not null,
  data      jsonb not null,

  constraint document_rows_index_non_negative check (row_index >= 0)
);

create unique index document_rows_table_index_key
  on public.document_rows (table_id, row_index);

-- Row count is derived, so Postgres maintains it.
create function public.sync_document_table_row_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct table_id) into ids from inserted;
  else
    select array_agg(distinct table_id) into ids from deleted;
  end if;

  update public.document_tables t
  set row_count = c.total
  from (
    select u.id, count(r.id)::integer as total
    from unnest(ids) as u(id)
    left join public.document_rows r on r.table_id = u.id
    group by u.id
  ) c
  where t.id = c.id;

  return null;
end;
$$;

create trigger document_rows_sync_count_insert
  after insert on public.document_rows
  referencing new table as inserted
  for each statement execute function public.sync_document_table_row_count();

create trigger document_rows_sync_count_delete
  after delete on public.document_rows
  referencing old table as deleted
  for each statement execute function public.sync_document_table_row_count();

alter table public.document_tables enable row level security;
alter table public.document_rows   enable row level security;

-- Ownership is inherited through the document, the same way chunks do it.
create policy document_tables_via_document on public.document_tables
  for all to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_tables.document_id and d.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_tables.document_id and d.user_id = (select auth.uid())));

create policy document_rows_via_table on public.document_rows
  for all to authenticated
  using (exists (
    select 1
    from public.document_tables t
    join public.documents d on d.id = t.document_id
    where t.id = document_rows.table_id and d.user_id = (select auth.uid())))
  with check (exists (
    select 1
    from public.document_tables t
    join public.documents d on d.id = t.document_id
    where t.id = document_rows.table_id and d.user_id = (select auth.uid())));

-- Written in one call per sheet, the way chunks are.
create function public.insert_document_table(
  p_document_id uuid,
  p_name        text,
  p_header      text[],
  p_rows        jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.document_tables (document_id, name, header)
  values (p_document_id, p_name, p_header)
  on conflict (document_id, name) do update set header = excluded.header
  returning id into new_id;

  -- A re-ingest replaces the sheet rather than appending to it.
  delete from public.document_rows where table_id = new_id;

  insert into public.document_rows (table_id, row_index, data)
  select new_id, (ordinality - 1)::integer, value
  from jsonb_array_elements(p_rows) with ordinality as t(value, ordinality);

  return new_id;
end;
$$;
