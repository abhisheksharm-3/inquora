import { describe, expect, it } from "vitest";
import type { KindSpecialist } from "./kinds.types";
import { SPECIALISTS, specialistsFor } from "./specialists";

describe("SPECIALISTS", () => {
  it("covers every kind the schema allows, so no document falls through to generic handling", () => {
    expect(Object.keys(SPECIALISTS).sort()).toEqual([
      "doc",
      "github",
      "image",
      "pdf",
      "sheet",
      "slides",
      "video",
      "web",
    ]);
  });

  it("tells a spreadsheet to cast before it compares", () => {
    expect(SPECIALISTS.sheet.guidance).toContain("::numeric");
  });

  it("tells a video to carry timestamps", () => {
    expect(SPECIALISTS.video.guidance.toLowerCase()).toContain("timestamp");
  });

  it("states the limit of each kind that has one, rather than letting the model discover it", () => {
    // These are the kinds where the honest answer depends on knowing what is missing.
    for (const kind of ["github", "video", "sheet", "slides", "image", "web"] as const) {
      expect(SPECIALISTS[kind].caveat).toBeTruthy();
    }
  });
});

describe("specialistsFor", () => {
  it("returns one specialist per distinct kind attached", () => {
    const found = specialistsFor(["github", "sheet", "github"]);

    expect(found.map((s: KindSpecialist) => s.kind)).toEqual(["github", "sheet"]);
  });

  it("ignores a kind it does not know rather than failing the conversation", () => {
    expect(specialistsFor(["nonsense"])).toEqual([]);
  });

  it("returns nothing when nothing is attached", () => {
    expect(specialistsFor([])).toEqual([]);
  });
});
