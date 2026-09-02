-- The dense arm asked for more candidates than the index would ever return.
--
-- `limit greatest(p_limit * 4, 40)` requests 144 rows at the default, but an HNSW
-- scan returns at most `hnsw.ef_search`, which defaults to 40 — so the multiplier
-- was a no-op and the dense list was always capped at 40.
--
-- The part that matters more: `where c.document_id = any(...)` and the row-level
-- policy are applied *after* the index scan. With three fixture documents every
-- candidate is in scope and recall looks fine. As the table grows past one
-- person's corpus, those 40 globally-nearest chunks increasingly belong to
-- somebody else's documents, they are filtered out afterwards, and the dense arm
-- quietly returns less and less while the lexical arm carries the answer. Recall
-- falls with nothing failing.
--
-- pgvector's answer is iterative scanning: keep scanning until enough rows
-- survive the filter, rather than taking the first ef_search and discarding most
-- of them. Both settings are set inside the function so they apply to this query
-- and not to the session.

create or replace function public.search_chunks(
  p_document_ids uuid[],
  p_embedding    extensions.vector(1024),
  p_query        text,
  p_limit        integer default 12,
  p_k            integer default 60
)
returns table (
  chunk_id    uuid,
  document_id uuid,
  chunk_index integer,
  content     text,
  metadata    jsonb,
  score       real,
  embedding   extensions.halfvec(1024)
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  /*
   * Set here rather than in a SET clause on the function: this platform refuses
   * `set hnsw.iterative_scan` at definition time, and set_config with is_local
   * true applies to this transaction only, which is the same scope with none of
   * the permission.
   *
   * Relaxed ordering keeps scanning past the first ef_search until the filter has
   * yielded enough rows. Strict ordering would guarantee exact distance order at
   * more cost, and the fusion re-ranks anyway. ef_search is wide enough that a
   * person's own chunks stay reachable inside a corpus shared with every tenant.
   */
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  perform set_config('hnsw.ef_search', '200', true);

  return query
  with dense as (
    select c.id,
           row_number() over (
             order by (c.embedding::extensions.halfvec(1024))
                      operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
           ) as rank
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
    order by (c.embedding::extensions.halfvec(1024))
             operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
    limit greatest(p_limit * 4, 40)
  ),
  ranked_lexical as (
    select c.id,
           ts_rank_cd(c.tsv, websearch_to_tsquery('english', p_query)) as rank_score
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
      and c.tsv @@ websearch_to_tsquery('english', p_query)
    order by rank_score desc
    limit greatest(p_limit * 4, 40)
  ),
  lexical as (
    select id, row_number() over (order by rank_score desc) as rank
    from ranked_lexical
  ),
  fused as (
    select coalesce(d.id, l.id) as id,
           coalesce(1.0 / (p_k + d.rank), 0.0)
             + coalesce(1.0 / (p_k + l.rank), 0.0) as score
    from dense d
    full outer join lexical l on l.id = d.id
  )
  select c.id, c.document_id, c.chunk_index, c.content, c.metadata, f.score::real,
         c.embedding::extensions.halfvec(1024)
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc, c.chunk_index
  limit p_limit;
end;
$$;

comment on function public.search_chunks is
  'Hybrid retrieval in one call: pgvector for meaning, full-text for exact terms, '
  'fused by reciprocal rank. Iterative scanning is on because the document filter '
  'is applied after the index scan, so without it a growing corpus would silently '
  'starve the dense arm.';
