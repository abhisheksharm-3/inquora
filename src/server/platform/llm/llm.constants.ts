/**
 * Default answering model. A pinned version rather than the -latest alias: the
 * alias points at whatever is newest, which is also what everyone else points at,
 * and it answered 503 on the first deployed run. Overridable through ANSWER_MODEL.
 */
export const DEFAULT_MODEL = "google-genai:gemini-2.5-flash";

/** Low, because the answer is supposed to come from the documents. */
export const DEFAULT_TEMPERATURE = 0.2;

/**
 * Three attempts, because shared Gemini capacity answers 503 "this model is
 * currently experiencing high demand" often enough that one attempt loses a whole
 * answer to it.
 */
export const MAX_RETRIES = 3;
