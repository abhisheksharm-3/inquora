/**
 * How content is cut into passages. Every number here changes retrieval quality,
 * so they sit together rather than one per file: tuning them means comparing
 * them, and `bun run eval` is what says whether a change helped.
 */

/** Prose, recursive character splitting. 1000/200 is the design's starting point. */
export const PROSE_SIZE = 1000;
export const PROSE_OVERLAP = 200;

/** Documentation inside a repository, split on blank lines rather than characters. */
export const DOC_CHARS = 1200;

/** Rows per spreadsheet chunk. The header is repeated in each, so this is the body. */
export const SHEET_ROWS_PER_CHUNK = 40;

/** Seconds of speech per transcript chunk. */
export const TRANSCRIPT_WINDOW_SECONDS = 60;

/** Declarations listed in a file summary before it stops being a summary. */
export const MAX_DECLARATIONS = 60;

/** How far into a file to look for the comment that explains it. */
export const LEADING_COMMENT_LINES = 20;
export const LEADING_COMMENT_CHARS = 300;
