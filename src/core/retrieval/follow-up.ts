import { OPENING_WORDS, SHORT_MESSAGE_WORDS } from "./retrieval.constants";

/**
 * Pronouns and demonstratives that mean the subject was established earlier in
 * the conversation. Interrogatives are deliberately absent: "why is Q3 revenue
 * under forecast" opens with a question word and carries its own subject.
 */
const REFERRING_WORDS = new Set([
  "it",
  "its",
  "that",
  "this",
  "these",
  "those",
  "they",
  "them",
  "their",
  "he",
  "him",
  "his",
  "she",
  "her",
]);

/**
 * Whether a message has to be resolved against the conversation before it can be
 * embedded. "What about the second one?" embedded alone retrieves nothing useful,
 * because the vector describes the grammar and not the subject.
 *
 * A heuristic rather than a model call, because this runs on every message and
 * the old pipeline spent an LLM call on decisions of exactly this size. A
 * self-contained question skips resolution entirely.
 */
export const needsFollowUpResolution = (message: string, historyLength: number): boolean => {
  if (historyLength === 0) return false;

  const words = message
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return false;
  if (words.length <= SHORT_MESSAGE_WORDS) return true;

  return words.slice(0, OPENING_WORDS).some((word) => REFERRING_WORDS.has(word));
};
