/**
 * The dials on how a question is prepared and how passages are chosen.
 *
 * Relevance against diversity, and when a question is too short to search on its
 * own. Both are judgements, both are measurable with `bun run eval`, and both
 * were wrong in the system this replaces.
 */

/**
 * Weight on relevance against diversity in MMR. 1 is pure relevance, 0 is pure
 * diversity. The old engine passed a diversity threshold of 0.7 into this
 * parameter, giving diversity more than double the weight of relevance.
 */
export const MMR_LAMBDA = 0.3;

/** How many candidates the database returns per passage finally kept, since MMR only prunes. */
export const CANDIDATE_MULTIPLIER = 3;

/** Below this many words a question rarely carries its own subject. */
export const SHORT_MESSAGE_WORDS = 6;

/** How far into a message a referring word still governs the subject. */
export const OPENING_WORDS = 3;

/** Turns of history a follow-up rewrite is allowed to read. */
export const HISTORY_TURNS = 6;

/**
 * Passages the model finally sees. Named here because three places used to write
 * 12 as a literal and a fourth declared a different ceiling in a Zod schema that
 * nothing parsed.
 */
export const DEFAULT_RETRIEVAL_LIMIT = 12;
