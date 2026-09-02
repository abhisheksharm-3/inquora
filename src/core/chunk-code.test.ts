import { describe, expect, it } from "vitest";
import { chunkCode, languageOf } from "./chunk-code";

const file = (content: string) => ({ path: "src/thing.ts", language: "typescript", content });

describe("chunkCode", () => {
  it("cuts at a declaration rather than mid-function", () => {
    const content = [
      "export function first() {",
      "  // a body long enough to matter to the splitter, repeated for length.",
      "  return 1;".repeat(20),
      "}",
      "",
      "export function second() {",
      "  return 2;",
      "}",
    ].join("\n");

    const chunks = chunkCode(file(content));

    expect(chunks.length).toBeGreaterThan(1);
    // Neither chunk may end mid-signature.
    expect(chunks[1].content.startsWith("export function second")).toBe(true);
  });

  it("carries the file path and the line range, so a citation points at lines", () => {
    const chunks = chunkCode(file("const a = 1;\nconst b = 2;"));

    expect(chunks[0].metadata).toMatchObject({
      path: "src/thing.ts",
      language: "typescript",
      fromLine: 1,
    });
  });

  it("keeps consecutive short declarations together", () => {
    const content = ["type A = string;", "type B = number;", "type C = boolean;"].join("\n");

    expect(chunkCode(file(content))).toHaveLength(1);
  });

  it("numbers chunks from the offset it was given, so files share one sequence", () => {
    const chunks = chunkCode(file("const a = 1;"), 7);

    expect(chunks[0].index).toBe(7);
  });

  it("returns nothing for an empty file", () => {
    expect(chunkCode(file("   \n  \n"))).toEqual([]);
  });

  it("splits a declaration that is longer than the cap, rather than emitting one huge chunk", () => {
    const chunks = chunkCode(file(`function big() {\n${"  const x = 1;\n".repeat(400)}}`));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThan(2200);
  });
});

describe("languageOf", () => {
  it("names the language from the extension", () => {
    expect(languageOf("a/b/c.ts")).toBe("typescript");
    expect(languageOf("main.py")).toBe("python");
    expect(languageOf("Cargo.toml")).toBe("toml");
  });

  it("falls back to the extension itself rather than to unknown", () => {
    expect(languageOf("weird.zig")).toBe("zig");
  });
});
