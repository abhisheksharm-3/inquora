import type { Outline, OutlineHeading } from "./outline.types";

export type { Outline, OutlineHeading, OutlineSheet, OutlineFile } from "./outline.types";

/**
 * What a document is made of.
 *
 * The point is to answer "where in this would the answer be" without searching.
 * A model that can read an outline first asks a better question of retrieval, and
 * a model that cannot has to search twice to find out that a document has no
 * section about what was asked.
 */

/** Markdown ATX headings. Setext is not matched: it is rare in extracted text. */
const HEADING = /^(#{1,6})\s+(.+)$/gm;

/** Below this many characters a document has no structure worth summarizing. */
const MIN_LENGTH = 200;

export const outlineFromText = (text: string): Outline => {
  const outline: Outline = { characters: text.length };

  if (text.length < MIN_LENGTH) return outline;

  const headings: OutlineHeading[] = [];

  for (const match of text.matchAll(HEADING)) {
    headings.push({
      level: match[1].length,
      title: match[2].trim(),
      at: match.index ?? 0,
    });
  }

  if (headings.length > 0) outline.headings = headings;

  return outline;
};

export const outlineFromSheets = (
  sheets: { name: string; header: string[]; rows: unknown[] }[],
): Outline => ({
  sheets: sheets.map((sheet) => ({
    name: sheet.name,
    columns: sheet.header,
    rows: sheet.rows.length,
  })),
});
