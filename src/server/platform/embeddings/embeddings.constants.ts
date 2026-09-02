/** Every embedding in this system has 1024 dimensions. See CLAUDE.md. */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * The longest the client will hold a request open waiting out a 429. Anything
 * longer is handed back, because the ingestion worker has a queue with its own
 * backoff and a query has a user waiting.
 */
export const MAX_INLINE_WAIT_SECONDS = 2;

/** A cold Space has been measured at eighteen seconds. */
export const QUERY_TIMEOUT_MS = 60_000;
export const BATCH_TIMEOUT_MS = 120_000;

/** Chunks per embedding call. The endpoint takes an array. */
export const EMBEDDING_BATCH = 32;

/** Thirty days. A query embedding does not go stale. */
export const EMBEDDING_TTL_SECONDS = 60 * 60 * 24 * 30;
