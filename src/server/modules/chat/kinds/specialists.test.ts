import { describe, expect, it } from "vitest";
import { SPECIALISTS, specialistsFor, toolsFor, UNIVERSAL_TOOLS } from "./specialists";

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

  it("sends a repository to grep and read_file rather than to a meaning-based search alone", () => {
    expect(SPECIALISTS.github.tools).toContain("grep_document");
    expect(SPECIALISTS.github.tools).toContain("read_file");
  });

  it("sends a spreadsheet to query_table rather than to search", () => {
    expect(SPECIALISTS.sheet.tools).toContain("query_table");
    expect(SPECIALISTS.sheet.guidance).toContain("::numeric");
  });

  it("tells a video to carry timestamps", () => {
    expect(SPECIALISTS.video.tools).toContain("get_transcript");
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

    expect(found.map((s) => s.kind)).toEqual(["github", "sheet"]);
  });

  it("ignores a kind it does not know rather than failing the conversation", () => {
    expect(specialistsFor(["nonsense"])).toEqual([]);
  });

  it("returns nothing when nothing is attached", () => {
    expect(specialistsFor([])).toEqual([]);
  });
});

describe("toolsFor", () => {
  it("always offers the tools that do not depend on a kind", () => {
    for (const name of UNIVERSAL_TOOLS) expect(toolsFor([])).toContain(name);
  });

  it("unions the tools of everything attached", () => {
    const tools = toolsFor(["sheet", "video"]);

    expect(tools).toContain("query_table");
    expect(tools).toContain("get_transcript");
  });

  it("does not repeat a tool two kinds share", () => {
    const tools = toolsFor(["pdf", "doc"]);

    expect(new Set(tools).size).toBe(tools.length);
  });
});
