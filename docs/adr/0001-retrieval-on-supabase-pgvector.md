# 0001. Retrieval moves to Supabase pgvector

Date: 2026-08-25
Status: accepted

## Context

Retrieval runs on Pinecone with one namespace per file. Four "strategies" — semantic, keyword,
contextual, step-back — all issue dense embedding queries against the same model, so the keyword
arm is dense search with a `"Keywords: …"` prefix (`rag/retrieval-engine.ts:118`). There is no
lexical arm. Index resolution calls `describeIndexStats()` across every configured index on every
query (`pinecone.ts:94`), a control-plane call in the hot path, kept alive by a legacy-index
fallback that is migration cruft.

Namespace-per-file also blocks the product goal: several documents in one chat would mean N
queries and client-side merging.

## Decision

Move vectors into the existing Supabase Postgres using pgvector. Retrieval becomes one
`search_chunks` SQL function fusing pgvector HNSW with Postgres full-text search through
reciprocal rank fusion.

## Consequences

Hybrid search becomes real: dense vectors for meaning, `tsvector` for exact terms such as error
codes and proper nouns that dense retrieval reliably misses. RRF fuses two rank lists without
needing calibrated scores, which is why it replaces the current weighted-score blending.

Multi-document chat becomes `WHERE document_id = ANY($1)` — an array parameter, not a rebuild.

One vendor instead of two, and one bill instead of two. RLS covers retrieval because the function
is `security invoker`.

Costs: the corpus must be re-embedded (241 documents, one batch job at current size), and vector
search now competes with application queries for the same Postgres resources. At this scale that
trade is clearly favorable; at very large corpora it would need revisiting.
