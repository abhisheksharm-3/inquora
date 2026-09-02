-- Read-only SQL over one spreadsheet.
--
-- The query is written by a language model, so every guard here is load-bearing:
--
--   * one statement, and it must be a select
--   * no semicolons, so nothing can be appended to it
--   * a keyword deny list for anything that writes, reads the catalog, or calls
--     out of the database
--   * the rows are exposed as a temporary view named `t`, built from this
--     document's rows only, so there is nothing else in scope to name
--   * a statement timeout and a row cap
--
-- security invoker, so the caller's row-level security decides whether they can
-- see the document at all. A user cannot query somebody else's spreadsheet
-- because the view is built from a select they are not allowed to make.

create function public.query_document_table(
  p_document_id uuid,
  p_table_name  text,
  p_sql         text,
  p_limit       integer default 200
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  table_id   uuid;
  header     text[];
  columns    text;
  normalized text := lower(btrim(p_sql));
  result     jsonb;
  forbidden  text;
begin
  if normalized = '' then
    raise exception 'the query is empty';
  end if;

  if left(normalized, 6) <> 'select' and left(normalized, 4) <> 'with' then
    raise exception 'only a select is allowed here';
  end if;

  -- A semicolon is how one statement becomes two.
  if position(';' in normalized) > 0 then
    raise exception 'the query must be a single statement with no semicolon';
  end if;

  foreach forbidden in array array[
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant',
    'revoke', 'copy', 'vacuum', 'analyze', 'comment', 'set ', 'reset', 'call',
    'do ', 'execute', 'listen', 'notify', 'lock', 'pg_', 'information_schema',
    'dblink', 'pg_read_file', 'pg_sleep', 'current_setting', 'set_config'
  ]
  loop
    if position(forbidden in normalized) > 0 then
      raise exception 'the query may not use %', trim(forbidden);
    end if;
  end loop;

  select t.id, t.header into table_id, header
  from public.document_tables t
  where t.document_id = p_document_id and t.name = p_table_name;

  if table_id is null then
    raise exception 'no sheet named % in that document', p_table_name;
  end if;

  -- Each header becomes a real column, quoted, so the model writes the query
  -- against the names it saw in the outline.
  select string_agg(format('r.data ->> %L as %I', name, name), ', ' order by ordinality)
  into columns
  from unnest(header) with ordinality as h(name, ordinality);

  execute format(
    'create temporary view t as select %s from public.document_rows r where r.table_id = %L',
    columns,
    table_id
  );

  -- Ten seconds is longer than any question about a spreadsheet needs, and short
  -- enough that a runaway cannot hold a connection.
  set local statement_timeout = '10s';

  begin
    execute format(
      'select coalesce(jsonb_agg(row_to_json(q)), ''[]''::jsonb) from (select * from (%s) as inner_q limit %s) as q',
      p_sql,
      least(greatest(p_limit, 1), 1000)
    )
    into result;
  exception when others then
    drop view if exists t;
    raise;
  end;

  drop view if exists t;

  return result;
end;
$$;

comment on function public.query_document_table is
  'Runs one read-only select over a single spreadsheet, exposed as a view named t '
  'with the sheet''s own column names. The query comes from a language model, so '
  'the guards are the point rather than a formality.';
