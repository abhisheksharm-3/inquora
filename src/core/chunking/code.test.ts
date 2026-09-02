import { describe, expect, it } from "vitest";
import { chunkCodeFile, languageOf } from "./code";

const code = (content: string, path = "src/thing.ts") => ({
  path,
  language: "typescript",
  content,
});

describe("chunkCodeFile", () => {
  it("summarizes a code file rather than embedding its bodies", () => {
    const content = [
      "// Reads a document and turns it into chunks.",
      "import { thing } from './thing';",
      "",
      "export function extract() {",
      `  ${"const x = 1;\n  ".repeat(200)}`,
      "}",
      "",
      "export class Reader {}",
    ].join("\n");

    const chunks = chunkCodeFile(code(content));

    // One chunk for the file, not one per function body: an exact question is
    // answered by grep, and a vague one by what the file says it contains.
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Reads a document and turns it into chunks");
    expect(chunks[0].content).toContain("export function extract()");
    expect(chunks[0].content).toContain("export class Reader");
    // And not the body.
    expect(chunks[0].content).not.toContain("const x = 1");
  });

  it("keeps the comment's prose and drops its syntax", () => {
    const content = [
      "/**",
      " * Reads a document and turns it into chunks.",
      " */",
      "export function extract() {}",
    ].join("\n");

    const chunks = chunkCodeFile(code(content));

    expect(chunks[0].content).toContain("Reads a document and turns it into chunks");
    // No stray comment markers, which are not prose and confuse an embedding.
    expect(chunks[0].content).not.toMatch(/\*\s*\/|\/\s*\*/);
  });

  it("records the path, the language and how many declarations it found", () => {
    const chunks = chunkCodeFile(code("export function a() {}\nexport function b() {}"));

    expect(chunks[0].metadata).toMatchObject({
      path: "src/thing.ts",
      language: "typescript",
      declarations: 2,
      summary: true,
    });
  });

  it("numbers each declaration by its line, so a reader can jump to it", () => {
    const chunks = chunkCodeFile(code("\n\nexport function third() {}"));

    expect(chunks[0].content).toContain("3: export function third()");
  });

  it("returns nothing for a file with neither a comment nor a declaration", () => {
    expect(chunkCodeFile(code("const a = 1;\nconst b = 2;"))).toEqual([]);
  });

  it("chunks documentation whole, because prose is what embeddings are good at", () => {
    const markdown = {
      path: "README.md",
      language: "markdown",
      content: "# Inquora\n\nChat with your documents.\n\n## Setup\n\nRun bun install.",
    };

    const chunks = chunkCodeFile(markdown);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain("Chat with your documents");
    // Documentation is not summarized into declarations.
    expect(chunks[0].metadata).not.toHaveProperty("summary");
  });

  it("splits long documentation on blank lines rather than mid-sentence", () => {
    const markdown = {
      path: "GUIDE.md",
      language: "markdown",
      content: Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${"word ".repeat(20)}`).join(
        "\n\n",
      ),
    };

    const chunks = chunkCodeFile(markdown);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThan(2000);
  });

  it("numbers chunks from the offset it was given, so files share one sequence", () => {
    expect(chunkCodeFile(code("export function a() {}"), 7)[0].index).toBe(7);
  });
});

describe("languageOf", () => {
  it("names the language from the extension", () => {
    expect(languageOf("a/b/c.ts")).toBe("typescript");
    expect(languageOf("main.py")).toBe("python");
    expect(languageOf("Cargo.toml")).toBe("toml");
    expect(languageOf("README.md")).toBe("markdown");
  });

  it("falls back to the extension itself rather than to unknown", () => {
    expect(languageOf("weird.zig")).toBe("zig");
  });
});
