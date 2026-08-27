-- Hybrid retrieval in one roundtrip: pgvector for meaning, Postgres full-text
-- for exact terms such as error codes and proper nouns that dense retrieval
-- reliably misses, fused with reciprocal rank fusion.
--
-- RRF fuses two rank lists without needing the two scoring scales to be
-- comparable, which is why it replaces the weighted score blending of the old
-- engine — where a cosine similarity and a keyword heuristic were added
-- together as if they meant the same thing.
--
-- security invoker (the default, stated for the reader) so row-level security
-- still applies to the caller.
create function public.search_chunks(
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
  score       real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with dense as (
    -- The distance expression matches document_chunks_embedding_idx exactly,
    -- including the halfvec cast. Ordering by the full-precision vector here
    -- would be correct and would never touch the index.
    --
    -- operator(extensions.<=>) rather than <=>: search_path is empty, and an
    -- operator cannot be schema-qualified by prefixing it the way a type can.
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
  lexical as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', p_query)) desc
           ) as rank
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
      and c.tsv @@ websearch_to_tsquery('english', p_query)
    limit greatest(p_limit * 4, 40)
  ),
  fused as (
    select coalesce(d.id, l.id) as id,
           coalesce(1.0 / (p_k + d.rank), 0.0)
             + coalesce(1.0 / (p_k + l.rank), 0.0) as score
    from dense d
    full outer join lexical l on l.id = d.id
  )
  select c.id, c.document_id, c.chunk_index, c.content, c.metadata, f.score::real
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc, c.chunk_index
  limit p_limit;
$$;
