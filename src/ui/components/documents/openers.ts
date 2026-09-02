import type { DocumentEntry } from "@/core/workspace/workspace.types";

/**
 * Questions worth asking of these particular documents.
 *
 * Generated from what somebody has actually added, never generic. A generic
 * suggestion is worse than none, because it teaches the reader that the product
 * does not know what it is holding.
 *
 * Shared by the home screen and the empty conversation, which were about to
 * grow two copies of the same list.
 */
export const openersFor = (documents: DocumentEntry[], limit = 3): string[] => {
  const first = documents[0];
  if (!first) return [];

  const openers: string[] = [];
  const has = (kind: DocumentEntry["kind"]) => documents.some((entry) => entry.kind === kind);

  if (has("sheet")) openers.push("Which figures moved most, and by how much?");
  if (has("github")) openers.push("Where is the entry point, and what does it call first?");
  if (has("video")) openers.push("What was decided, and at what point was it said?");
  if (has("slides")) openers.push("What is the argument, slide by slide?");
  if (has("web")) openers.push("What is this page claiming, and what does it cite?");

  openers.push(`What is ${first.title} actually saying?`);
  openers.push("What does this conclude, and where does it say so?");

  if (documents.length > 1) openers.push("Where do these documents disagree?");

  return openers.slice(0, limit);
};
