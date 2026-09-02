import type { Candidate, MmrOptions } from "./mmr.types";

export type { Candidate, MmrOptions } from "./mmr.types";
/** Cosine similarity, returning 0 rather than NaN when either vector is zero. */
const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length && i < b.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Maximal marginal relevance over the embeddings the search returned.
 *
 * The point is to stop three chunks that say the same thing from occupying the
 * whole context window. The previous implementation compared full document text
 * by Jaccard word overlap, which measures vocabulary rather than meaning and
 * ran over the document instead of the chunk.
 */
export const mmr = (candidates: Candidate[], { lambda, limit }: MmrOptions): Candidate[] => {
  const remaining = [...candidates].sort((a, b) => b.score - a.score);
  const picked: Candidate[] = [];

  while (remaining.length > 0 && picked.length < limit) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const redundancy = picked.reduce(
        (worst, chosen) => Math.max(worst, cosine(candidate.embedding, chosen.embedding)),
        0,
      );
      const value = lambda * candidate.score - (1 - lambda) * redundancy;

      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    picked.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return picked;
};
