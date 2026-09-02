import {
  DOC_CHARS,
  LEADING_COMMENT_CHARS,
  LEADING_COMMENT_LINES,
  MAX_DECLARATIONS,
} from "./chunking.constants";
import type { Chunk, CodeFile } from "./chunking.types";

/**
 * How a repository becomes searchable.
 *
 * Not by embedding every function body. The first version of this did, and it
 * cost 2,664 chunks for one repository of 399 files — eighty embedding calls to
 * index code that a regex answers better, because an identifier is exactly what a
 * dense vector flattens.
 *
 * So the split is by question. An exact question — where is this called, what is
 * this constant, which file raises this error — is answered by grep and read_file
 * over the stored files, needing no vector at all. A vague question — how does
 * ingestion work, where does authentication live — is answered by embedding what
 * describes the code rather than the code itself: its documentation, and the
 * declarations that name what each file contains.
 */

/** What a declaration looks like at the start of a line, across the languages here. */
const DECLARATION =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const\s+\w+\s*=\s*(?:async\s*)?\(|def|struct|impl|trait|fn|public|private|protected|package|func)\b/;

/** A comment line, which is where a file explains itself. */
const COMMENT = /^\s*(?:\/\/|\/\*\*?|\*|#|--)\s?(.*)$/;

/** Comment syntax left at the end of a captured line, which is not prose. */
const COMMENT_TAIL = /[*/\s]+$/;

/** Documentation is chunked whole, because prose is what embeddings are good at. */
const PROSE_LANGUAGES = new Set(["markdown", "mdx", "text"]);

/**
 * A file's declarations and leading comments, as one chunk that says what the file
 * contains. This is what a vague question matches against.
 */
export const chunkCodeFile = (file: CodeFile, startIndex = 0): Chunk[] => {
  if (PROSE_LANGUAGES.has(file.language)) return chunkProseFile(file, startIndex);

  const lines = file.content.split("\n");
  const signatures: string[] = [];
  let leadingComment = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // The comment at the top of a file is usually the one sentence that explains
    // it, and it is worth more to a search than any single signature.
    if (i < LEADING_COMMENT_LINES && leadingComment.length < LEADING_COMMENT_CHARS) {
      const comment = COMMENT.exec(line);
      const prose = comment?.[1]?.replace(COMMENT_TAIL, "").trim();

      if (prose) leadingComment += `${prose} `;
    }

    if (DECLARATION.test(line)) signatures.push(`${i + 1}: ${line.trim().slice(0, 200)}`);
  }

  if (signatures.length === 0 && leadingComment.trim().length === 0) return [];

  const summary = [
    file.path,
    leadingComment.trim(),
    signatures.length > 0 ? `Declares:\n${signatures.slice(0, MAX_DECLARATIONS).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      index: startIndex,
      content: summary,
      metadata: {
        path: file.path,
        language: file.language,
        declarations: signatures.length,
        summary: true,
      },
    },
  ];
};

/** Documentation, split on blank lines so a section stays whole. */
const chunkProseFile = (file: CodeFile, startIndex: number): Chunk[] => {
  const blocks = file.content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim().length === 0) return;

    chunks.push({
      index: startIndex + chunks.length,
      content: `${file.path}\n\n${buffer.trim()}`,
      metadata: { path: file.path, language: file.language },
    });

    buffer = "";
  };

  for (const block of blocks) {
    if (buffer.length + block.length > DOC_CHARS) flush();
    buffer = buffer.length > 0 ? `${buffer}\n\n${block}` : block;
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
      mjs: "javascript",
      cjs: "javascript",
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
      hpp: "cpp",
      cs: "csharp",
      php: "php",
      sql: "sql",
      sh: "shell",
      md: "markdown",
      mdx: "mdx",
      txt: "text",
      json: "json",
      yml: "yaml",
      yaml: "yaml",
      toml: "toml",
    }[extension] ?? extension
  );
};
