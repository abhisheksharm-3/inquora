import { describe, expect, it } from "vitest";
import { mmr, type Candidate } from "./mmr";

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
