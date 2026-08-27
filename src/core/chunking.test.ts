import { describe, expect, it } from "vitest";
import { chunkProse, chunkSheet, chunkTranscript } from "./chunking";

describe("chunkProse", () => {
  it("splits on paragraph boundaries before sentence boundaries", () => {
    const text = ["First paragraph.", "Second paragraph.", "Third paragraph."].join("\n\n");
    const chunks = chunkProse(text, { size: 40, overlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content).toContain("First paragraph.");
  });

  it("keeps every chunk within the size it was given, allowing for overlap", () => {
    const text = "word ".repeat(600);
    const chunks = chunkProse(text, { size: 200, overlap: 40 });

    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(240);
  });

  it("overlaps consecutive chunks, so a sentence on a boundary is not lost", () => {
    const text = Array.from({ length: 40 }, (_, i) => `sentence number ${i}.`).join(" ");
    const chunks = chunkProse(text, { size: 120, overlap: 40 });

    const tail = chunks[0].content.slice(-20).trim();
    expect(chunks[1].content).toContain(tail.split(" ").at(-1)!);
  });

  it("numbers chunks from zero, in order", () => {
    const chunks = chunkProse("word ".repeat(300), { size: 100, overlap: 10 });
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("returns nothing for empty input rather than one empty chunk", () => {
    expect(chunkProse("   \n\n  ", { size: 100, overlap: 10 })).toEqual([]);
  });

  it("carries the heading a passage sits under", () => {
    const text =
      "# Revenue\n\nQ3 closed under forecast.\n\n## Northern region\n\nThree deals slipped.";
    const chunks = chunkProse(text, { size: 60, overlap: 0 });

    expect(chunks.at(-1)?.metadata.heading).toBe("Northern region");
  });

  it("starts a new chunk at a heading, so two sections never share one", () => {
    const text = "# One\n\nShort.\n\n# Two\n\nAlso short.";
    const chunks = chunkProse(text, { size: 500, overlap: 0 });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.heading).toBe("One");
    expect(chunks[1].metadata.heading).toBe("Two");
  });
});

describe("chunkSheet", () => {
  const sheet = {
    name: "Q3 pipeline",
    header: ["Account", "Stage", "Value"],
    rows: [
      ["Northwind", "Closed won", "48000"],
      ["Acme", "Proposal", "31000"],
      ["Globex", "Closed lost", "22000"],
      ["Initech", "Proposal", "17000"],
    ],
  };

  it("repeats the header row in every chunk", () => {
    const chunks = chunkSheet(sheet, { rowsPerChunk: 2 });

    expect(chunks).toHaveLength(2);
    // Without this, every chunk after the first loses its column names and the
    // numbers in it stop meaning anything.
    for (const chunk of chunks) expect(chunk.content).toContain("Account | Stage | Value");
  });

  it("records the sheet name and the row range it covers", () => {
    const chunks = chunkSheet(sheet, { rowsPerChunk: 2 });

    expect(chunks[1].metadata).toMatchObject({ sheet: "Q3 pipeline", fromRow: 2, toRow: 3 });
  });

  it("keeps rows whole, never splitting one across two chunks", () => {
    const chunks = chunkSheet(sheet, { rowsPerChunk: 3 });

    expect(chunks[0].content).toContain("Globex");
    expect(chunks[1].content).toContain("Initech");
    expect(chunks[0].content).not.toContain("Initech");
  });

  it("returns nothing for a sheet with no rows", () => {
    expect(chunkSheet({ ...sheet, rows: [] }, { rowsPerChunk: 2 })).toEqual([]);
  });
});

describe("chunkTranscript", () => {
  const lines = [
    { start: 0, text: "Welcome to the quarterly review." },
    { start: 30, text: "Revenue came in under forecast." },
    { start: 75, text: "The northern region explains most of it." },
    { start: 130, text: "Questions at the end please." },
  ];

  it("windows by time rather than by line count", () => {
    const chunks = chunkTranscript(lines, { windowSeconds: 60 });

    // Lines at 0s and 30s share the first window. 75s opens the second, and 130s
    // is 55 seconds after it, so it joins rather than starting a third.
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain("Welcome");
    expect(chunks[0].content).toContain("under forecast");
    expect(chunks[1].content).toContain("northern region");
  });

  it("carries the start and end timestamp, so a citation can deep-link", () => {
    const chunks = chunkTranscript(lines, { windowSeconds: 60 });

    expect(chunks[0].metadata).toMatchObject({ startSeconds: 0, endSeconds: 30 });
  });

  it("returns nothing for an empty transcript", () => {
    expect(chunkTranscript([], { windowSeconds: 60 })).toEqual([]);
  });
});
