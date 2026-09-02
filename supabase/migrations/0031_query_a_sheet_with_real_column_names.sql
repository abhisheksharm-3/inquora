-- A spreadsheet with an "Updated" column could never be queried.
--
-- The guard scanned the whole statement for forbidden substrings, so a legitimate
-- column name refused the query forever: `select "Updated" from t` was rejected
-- as using `update`, `Created` as `create`, `Comments` as `comment`, `Call Count`
-- as `call`. The header becomes a real quoted column, so the sheet was
-- unqueryable and the model was told "the query may not use update", which it
-- cannot comply with.
--
-- Two changes. Literals and quoted identifiers are removed before anything is
-- scanned, so a column name and a cell value cannot trigger a keyword. And what
-- remains is matched on word boundaries rather than as substrings, so `complete`
-- no longer reads as `delete`.
--
-- Then the check that actually mattered: no function calls except a small
-- arithmetic and aggregate list. The deny list could never see a verb hidden in a
-- function name — `select public.fail_ingestion_job(...)` contains none of the
-- forbidden words — and a deny list against a language model writing SQL is the
-- shape that cannot be finished. The revoke in 0022 closed that path; this closes
-- the class.

create or replace function public.query_document_table(
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
  /** The statement with every literal and quoted identifier blanked out. */
  bare       text;
  called     text;
  result     jsonb;
begin
  if btrim(coalesce(p_sql, '')) = '' then
    raise exception 'the query is empty';
  end if;

  -- 'a value' and "A Column" become empty, so neither can carry a keyword.
  bare := lower(regexp_replace(regexp_replace(p_sql, '''[^'']*''', '''''', 'g'), '"[^"]*"', '""', 'g'));

  if left(btrim(bare), 6) <> 'select' and left(btrim(bare), 4) <> 'with' then
    raise exception 'only a select is allowed here';
  end if;

  if position(';' in bare) > 0 then
    raise exception 'the query must be a single statement with no semicolon';
  end if;

  -- Word boundaries, so a column called Created is not a create.
  if bare ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|analyze|comment|reset|call|do|execute|listen|notify|lock|declare|fetch|move|prepare|refresh|reindex|security|returning)\M'
     or bare ~ '\mset\M' then
    raise exception 'a query here may only read: no statement that writes or changes session state';
  end if;

  /*
   * Any function call at all is refused unless it is on this list. This is the
   * check that closes the class rather than another keyword: it does not matter
   * what a function is named if it cannot be called.
   */
  for called in
    select distinct m[1]
    from regexp_matches(bare, '([a-z_][a-z0-9_]*)\s*\(', 'g') as m
  loop
    if called not in (
      'count', 'sum', 'avg', 'min', 'max', 'round', 'abs', 'ceil', 'ceiling', 'floor',
      'trunc', 'power', 'sqrt', 'mod', 'greatest', 'least', 'coalesce', 'nullif',
      'length', 'lower', 'upper', 'trim', 'btrim', 'ltrim', 'rtrim', 'substr',
      'substring', 'replace', 'split_part', 'concat', 'left', 'right', 'position',
      'strpos', 'to_char', 'to_number', 'to_date', 'date_part', 'date_trunc',
      'extract', 'cast', 'nullif', 'stddev', 'variance', 'percentile_cont',
      'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value',
      'over', 'array_agg', 'string_agg', 'json_agg', 'jsonb_agg', 'distinct'
    ) then
      raise exception 'a query here may not call %()', called
        using hint = 'arithmetic, aggregates and string functions only';
    end if;
  end loop;

  select t.id, t.header into table_id, header
  from public.document_tables t
  where t.document_id = p_document_id and t.name = p_table_name;

  if table_id is null then
    raise exception 'no sheet named % in that document', p_table_name;
  end if;

  select string_agg(format('r.data ->> %L as %I', name, name), ', ' order by ordinality)
  into columns
  from unnest(header) with ordinality as h(name, ordinality);

  execute format(
    'create temporary view t as select %s from public.document_rows r where r.table_id = %L',
    columns,
    table_id
  );

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
  'One read-only select over a single sheet, exposed as a view named t with the '
  'sheet''s own column names. Literals and identifiers are blanked before the '
  'statement is checked, so a column called Updated is a column and not a verb, '
  'and no function may be called except arithmetic, aggregates and string '
  'functions — which is what closes the class rather than one more keyword.';
