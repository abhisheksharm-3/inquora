/**
 * The return type used across layer boundaries. Errors travel as values so a
 * caller cannot ignore one by forgetting a try/catch.
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
