import type { Candidate, MmrOptions } from "./mmr.types";

/**
 * Scores onto 0..1 across the candidate set, because the two terms have to be
 * comparable before they can be weighed against each other.
 *
 * The fused score from `search_chunks` is a reciprocal rank sum bounded by
 * 2/(60+1), about 0.033, while the redundancy term is a cosine in 0..1. Mixed
 * raw, a five percent difference in similarity outweighed the entire range of
 * relevance, so lambda 0.3 read as relevance-dominant and behaved as almost pure
 * diversity — the opposite of what the constant claims.
 */
const normalize = (candidates: Candidate[]): Map<string, number> => {
  const scores = candidates.map((candidate) => candidate.score);
  const lowest = Math.min(...scores);
  const highest = Math.max(...scores);
  const spread = highest - lowest;

  return new Map(
    candidates.map((candidate) => [
      candidate.id,
      // Every candidate equally relevant means relevance cannot discriminate, so
      // the diversity term decides. That is the right answer, not a division by
      // zero.
      spread === 0 ? 1 : (candidate.score - lowest) / spread,
    ]),
  );
};

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
  const relevance = normalize(remaining);

  while (remaining.length > 0 && picked.length < limit) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const redundancy = picked.reduce(
        (worst, chosen) => Math.max(worst, cosine(candidate.embedding, chosen.embedding)),
        0,
      );
      const value = lambda * (relevance.get(candidate.id) ?? 0) - (1 - lambda) * redundancy;

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
