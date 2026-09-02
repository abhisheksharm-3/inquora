import { describe, expect, it } from "vitest";
import { outlineFromSheets, outlineFromText } from "./outline";

const long = (body: string) => `${body}\n${"filler text. ".repeat(30)}`;

describe("outlineFromText", () => {
  it("lists headings with their level and position", () => {
    const outline = outlineFromText(long("# Revenue\n\nBody.\n\n## Northern region\n\nMore."));

    expect(outline.headings).toHaveLength(2);
    expect(outline.headings?.[0]).toMatchObject({ level: 1, title: "Revenue" });
    expect(outline.headings?.[1]).toMatchObject({ level: 2, title: "Northern region" });
    expect(outline.headings?.[1].at).toBeGreaterThan(outline.headings![0].at);
  });

  it("records the length, so the model knows the size of what it is reading", () => {
    const text = long("# One\n\nBody.");
    expect(outlineFromText(text).characters).toBe(text.length);
  });

  it("returns no headings for a document that has none", () => {
    expect(outlineFromText(long("Just prose, no structure at all.")).headings).toBeUndefined();
  });

  it("does not bother summarizing something too short to have structure", () => {
    const short = "# Tiny\n\nOne line.";
    const outline = outlineFromText(short);

    expect(outline.headings).toBeUndefined();
    expect(outline.characters).toBe(short.length);
  });
});

describe("outlineFromSheets", () => {
  it("describes each sheet by its columns and row count", () => {
    const outline = outlineFromSheets([
      { name: "Pipeline", header: ["Account", "Value"], rows: [1, 2, 3] },
      { name: "Targets", header: ["Region", "Target"], rows: [1] },
    ]);

    expect(outline.sheets).toEqual([
      { name: "Pipeline", columns: ["Account", "Value"], rows: 3 },
      { name: "Targets", columns: ["Region", "Target"], rows: 1 },
    ]);
  });
});
