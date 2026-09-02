import type { Chunk } from "./chunking.types";

export type { CodeFile } from "./chunking.types";
import type { CodeFile } from "./chunking.types";

/**
 * Splits source code on declaration boundaries rather than every N characters.
 *
 * A function cut in half is worse than useless for retrieval: neither half
 * compiles, neither half explains itself, and the half with the signature has
 * lost the body that answers the question. Splitting on the boundaries the
 * language already provides keeps each chunk a thing a reader recognises.
 *
 * Deliberately not a parser. A parser per language is a dependency per language,
 * and the only decision being made here is where to cut.
 */

/** What a declaration looks like at the start of a line, across the languages here. */
const DECLARATION =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const\s+\w+\s*=\s*(?:async\s*)?\(|def|struct|impl|trait|fn|public|private|protected|package|func)\b/;

/** A chunk above this many characters is split further, boundaries or not. */
const MAX_CHARS = 1600;

export const chunkCode = (file: CodeFile, startIndex = 0): Chunk[] => {
  const lines = file.content.split("\n");
  const chunks: Chunk[] = [];

  let buffer: string[] = [];
  let bufferStart = 1;

  const flush = () => {
    const content = buffer.join("\n").trim();

    if (content.length > 0) {
      chunks.push({
        index: startIndex + chunks.length,
        content,
        metadata: {
          path: file.path,
          language: file.language,
          fromLine: bufferStart,
          toLine: bufferStart + buffer.length - 1,
        },
      });
    }

    buffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const startsDeclaration = DECLARATION.test(line);
    const tooLong = buffer.join("\n").length + line.length > MAX_CHARS;

    // A declaration ends the previous chunk, but only once there is something to
    // end: consecutive declarations stay together, which is what a file of type
    // aliases or a class of short methods wants.
    if (
      buffer.length > 0 &&
      (tooLong || (startsDeclaration && buffer.join("\n").trim().length > 200))
    ) {
      flush();
      bufferStart = i + 1;
    }

    buffer.push(line);
  }

  flush();

  return chunks;
};

/** Extension to language name, for the metadata and for the reader. */
export const languageOf = (path: string): string => {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();

  return (
    {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      rb: "ruby",
      go: "go",
      rs: "rust",
      java: "java",
      kt: "kotlin",
      swift: "swift",
      c: "c",
      h: "c",
      cpp: "cpp",
      cs: "csharp",
      php: "php",
      sql: "sql",
      sh: "shell",
      md: "markdown",
      json: "json",
      yml: "yaml",
      yaml: "yaml",
      toml: "toml",
    }[extension] ?? extension
  );
};
