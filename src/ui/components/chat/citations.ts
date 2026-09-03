/**
 * Which passages an answer actually cites.
 *
 * The distinction matters more than it looks. A turn reported "12 sources"
 * because twelve passages were *retrieved*, while the answer to "how are Lady
 * Catherine and Darcy related" cited exactly one. An outside review of the
 * retrieval read that as poor precision; the retrieval was fine and the label
 * was wrong. Recall is how many candidates you fetch, and a reader does not
 * care — what they are owed is the count of passages the answer stands on.
 *
 * One regex, shared with the renderer, so the number in the footer and the
 * marks in the text can never disagree.
 */
export const MARK = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;

export const citedNumbers = (answer: string): Set<number> => {
  const cited = new Set<number>();

  for (const match of answer.matchAll(MARK)) {
    for (const part of match[1].split(",")) {
      const number = Number(part.trim());
      if (Number.isFinite(number)) cited.add(number);
    }
  }

  return cited;
};
