/** Redirect hops an external fetch will follow, each one validated. */
export const MAX_REDIRECTS = 3;

/** The largest external page this will read. */
export const MAX_FETCH_BYTES = 10 * 1024 * 1024;

/** How long an external fetch waits before giving up. */
export const FETCH_TIMEOUT_MS = 30_000;
