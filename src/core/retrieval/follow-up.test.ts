import { describe, expect, it } from "vitest";
import { needsFollowUpResolution } from "./follow-up";

describe("needsFollowUpResolution", () => {
  it("catches a demonstrative referring to something already said", () => {
    expect(needsFollowUpResolution("what about the second one?", 4)).toBe(true);
  });

  it("catches an opening pronoun", () => {
    expect(needsFollowUpResolution("does it apply to the other region too", 2)).toBe(true);
  });

  it("catches a bare short message", () => {
    expect(needsFollowUpResolution("and Q4?", 2)).toBe(true);
  });

  it("is false with no history, because there is nothing to resolve against", () => {
    expect(needsFollowUpResolution("what about the second one?", 0)).toBe(false);
  });

  it("is false for a self-contained question, which needs no extra call", () => {
    expect(
      needsFollowUpResolution(
        "why is Q3 revenue twelve percent under forecast when pipeline coverage was above target",
        6,
      ),
    ).toBe(false);
  });

  it("is false for an empty message", () => {
    expect(needsFollowUpResolution("   ", 4)).toBe(false);
  });

  it("does not treat a noun that merely starts with a pronoun as a pronoun", () => {
    expect(
      needsFollowUpResolution("theseus and the ship of parts, explained at length please", 4),
    ).toBe(false);
  });
});
