import type { Database } from "@/core/database.types";

export type DocumentKind = Database["public"]["Enums"]["document_kind"];

/**
 * Which handler a file gets, decided from its extension rather than the browser's
 * content type. A browser reports `application/octet-stream` for anything it does
 * not recognise, and reports nothing at all for a file dragged from some
 * archives, so the extension is the more reliable signal of the two.
 *
 * The server validates the answer against the same table, so a renamed
 * extension buys nothing: the extractor reads the bytes and fails on a
 * mismatch.
 */
const BY_EXTENSION: Record<string, DocumentKind> = {
  pdf: "pdf",

  doc: "doc",
  docx: "doc",
  rtf: "doc",
  txt: "doc",
  md: "doc",
  markdown: "doc",

  csv: "sheet",
  tsv: "sheet",
  xls: "sheet",
  xlsx: "sheet",

  ppt: "slides",
  pptx: "slides",

  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
};

/** The extension, lower-cased, or null for a name that has none. */
export const extensionOf = (filename: string): string | null => {
  const at = filename.lastIndexOf(".");

  return at > 0 && at < filename.length - 1 ? filename.slice(at + 1).toLowerCase() : null;
};

/** Null rather than a guess: a kind nothing can extract is refused at the door. */
export const kindForFilename = (filename: string): DocumentKind | null => {
  const extension = extensionOf(filename);

  return extension ? (BY_EXTENSION[extension] ?? null) : null;
};

/** Every extension the picker accepts, as an `accept` attribute. */
export const ACCEPTED_EXTENSIONS = Object.keys(BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(",");

/** What a person is told when the answer is null. */
export const ACCEPTED_DESCRIPTION =
  "PDF, Word, text and Markdown, spreadsheets, slides and images.";

/**
 * A link, and what reads it.
 *
 * These three kinds never touch storage: the extractor fetches them. A YouTube
 * video is read as its transcript by a service that already has one, a
 * repository is fetched as an archive, and a web page is fetched and stripped
 * to its text. The interface offered none of them for months while all three
 * worked.
 */
export const sourceKindForUrl = (raw: string): { kind: DocumentKind; url: string } | null => {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  // http and https only. A `file:` or `data:` URL would be asking the server to
  // read something on its own side.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
    return { kind: "video", url: url.toString() };
  }

  if (host === "github.com") return { kind: "github", url: url.toString() };

  return { kind: "web", url: url.toString() };
};

/** How a link reads in the register before its real title is known. */
export const titleForUrl = (raw: string, kind: DocumentKind): string => {
  try {
    const url = new URL(raw);

    if (kind === "github") return url.pathname.replace(/^\/+|\/+$/g, "") || url.hostname;
    if (kind === "video") return `Video · ${url.searchParams.get("v") ?? url.pathname.slice(1)}`;

    return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return raw;
  }
};
