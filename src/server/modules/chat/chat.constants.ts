/**
 * The limits on one answered message.
 *
 * A tool loop is the failure mode ADR 0005 brings, and these are what bound it.
 */

/** Tool calls in one run. Per message, not per thread, which is the boundary that matters. */
export const MAX_TOOL_CALLS = 8;

/** Rows one query_table call may return. */
export const MAX_TABLE_ROWS = 200;

/** Consecutive passages one read_chunks call may return, so a tool cannot pull a whole book. */
export const MAX_CHUNK_RANGE = 20;

/** Lines one read_file call may return. */
export const MAX_FILE_LINES = 400;

/** Seconds of transcript one get_transcript call may return. */
export const MAX_TRANSCRIPT_SECONDS = 600;
