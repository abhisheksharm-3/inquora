-- MMR runs over the embeddings, so search_chunks has to return them.
--
-- The design says "MMR over the embedding vectors search_chunks returns" for a
-- reason: the previous engine measured diversity by word overlap, which compares
-- vocabulary rather than meaning, and any in-process approximation of a vector
-- is the same mistake wearing a different name.
--
-- The cost is payload. Twelve chunks at the default limit, times the candidate
-- multiplier, is roughly 300KB of text-encoded floats per query. halfvec halves
-- it against vector, and the ranking only needs half precision. If this becomes
-- the bottleneck the next move is ranking inside the function, not a cheaper
-- similarity in TypeScript.
drop function if exists public.search_chunks(uuid[], extensions.vector, text, integer, integer);

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
  score       real,
  embedding   extensions.halfvec(1024)
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
  select c.id, c.document_id, c.chunk_index, c.content, c.metadata, f.score::real,
         c.embedding::extensions.halfvec(1024)
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc, c.chunk_index
  limit p_limit;
$$;
