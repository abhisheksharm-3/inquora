import { describe, expect, it } from "vitest";
import { mmr } from "./mmr";
import type { Candidate } from "./mmr.types";

const candidate = (id: string, embedding: number[], score: number): Candidate => ({
  id,
  embedding,
  score,
});

describe("mmr", () => {
  it("returns nothing for no candidates", () => {
    expect(mmr([], { lambda: 0.3, limit: 5 })).toEqual([]);
  });

  it("puts the most relevant candidate first", () => {
    const picked = mmr([candidate("low", [1, 0, 0], 0.1), candidate("high", [0, 1, 0], 0.9)], {
      lambda: 0.3,
      limit: 2,
    });
    expect(picked[0].id).toBe("high");
  });

  it("prefers a different vector over a near-duplicate of what is already picked", () => {
    const picked = mmr(
      [
        candidate("first", [1, 0, 0], 0.9),
        candidate("duplicate", [1, 0, 0], 0.85),
        candidate("different", [0, 1, 0], 0.5),
      ],
      { lambda: 0.3, limit: 2 },
    );
    expect(picked.map((c) => c.id)).toEqual(["first", "different"]);
  });

  it("degenerates to relevance order at lambda 1", () => {
    const picked = mmr(
      [
        candidate("a", [1, 0, 0], 0.9),
        candidate("b", [1, 0, 0], 0.8),
        candidate("c", [0, 1, 0], 0.7),
      ],
      { lambda: 1, limit: 3 },
    );
    expect(picked.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("never returns more than the limit", () => {
    const picked = mmr(
      [
        candidate("a", [1, 0, 0], 0.9),
        candidate("b", [0, 1, 0], 0.8),
        candidate("c", [0, 0, 1], 0.7),
      ],
      { lambda: 0.3, limit: 2 },
    );
    expect(picked).toHaveLength(2);
  });

  it("handles a zero vector without producing NaN", () => {
    const picked = mmr([candidate("zero", [0, 0, 0], 0.9), candidate("unit", [1, 0, 0], 0.5)], {
      lambda: 0.3,
      limit: 2,
    });
    expect(picked.map((c) => c.id)).toEqual(["zero", "unit"]);
  });
});

describe("mmr, with the score scales made comparable", () => {
  const rrf = (id: string, embedding: number[], score: number): Candidate => ({
    id,
    embedding,
    score,
  });

  it("keeps a much more relevant passage over a slightly more diverse one", () => {
    // Real fused scores from search_chunks are reciprocal rank sums bounded by
    // about 0.033, while cosine is 0..1. Mixed raw, the 0.016 relevance gap here
    // lost to a 0.5 cosine gap and MMR picked the less relevant chunk first.
    const picked = mmr([rrf("relevant", [1, 0, 0], 0.032), rrf("marginal", [0, 1, 0], 0.016)], {
      lambda: 0.3,
      limit: 1,
    });

    expect(picked[0].id).toBe("relevant");
  });

  it("still prunes a near-duplicate at realistic score magnitudes", () => {
    const picked = mmr(
      [
        rrf("first", [1, 0, 0], 0.033),
        rrf("duplicate", [1, 0, 0], 0.032),
        rrf("different", [0, 1, 0], 0.02),
      ],
      { lambda: 0.3, limit: 2 },
    );

    expect(picked.map((c) => c.id)).toEqual(["first", "different"]);
  });

  it("falls back to diversity when every candidate is equally relevant", () => {
    const picked = mmr(
      [rrf("a", [1, 0, 0], 0.02), rrf("b", [1, 0, 0], 0.02), rrf("c", [0, 1, 0], 0.02)],
      { lambda: 0.3, limit: 2 },
    );

    expect(picked.map((c) => c.id)).toEqual(["a", "c"]);
  });
});
