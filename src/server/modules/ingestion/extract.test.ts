import { describe, expect, it } from "vitest";
import { chunkSource } from "./extract";

describe("chunkSource", () => {
  it("splits prose kinds with overlap", () => {
    const result = chunkSource({ kind: "pdf", text: "word ".repeat(800) });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBeGreaterThan(1);
  });

  it("numbers sheet chunks continuously across sheets", () => {
    const sheet = (name: string) => ({
      name,
      header: ["A", "B"],
      rows: Array.from({ length: 50 }, (_, i) => [`${name}-${i}`, "x"]),
    });

    const result = chunkSource({ kind: "sheet", sheets: [sheet("one"), sheet("two")] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // chunk_index is unique per document, so the sequence cannot restart per sheet.
      expect(result.value.map((c) => c.index)).toEqual(result.value.map((_, i) => i));
      expect(result.value.length).toBe(4);
    }
  });

  it("windows a video transcript by time", () => {
    const result = chunkSource({
      kind: "video",
      transcript: [
        { start: 0, text: "first" },
        { start: 90, text: "second" },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it("says plainly when a document yielded no text, rather than storing nothing", () => {
    const result = chunkSource({ kind: "pdf", text: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(400);
  });

  it("says plainly when a video had no subtitles", () => {
    const result = chunkSource({ kind: "video", transcript: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("subtitles");
  });
});
