import type { DocumentEntry } from "@/core/workspace/workspace.types";

/**
 * How a document reads in a register: three letters of kind, then what it is
 * made of and when it was indexed, on one line under its name.
 */

/** `xls`, `git`, `vid` — three letters, because the column is three letters wide. */
export const kindLabel: Record<DocumentEntry["kind"], string> = {
  pdf: "pdf",
  doc: "doc",
  sheet: "xls",
  slides: "ppt",
  image: "img",
  video: "vid",
  github: "git",
  web: "www",
};

/** `4.2 MB`. Binary units, because that is what a file manager shows. */
export const formatBytes = (bytes: number | null): string | null => {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

/** `2 days ago`, `just now`. Relative, because the exact minute never matters here. */
export const formatWhen = (iso: string, now = Date.now()): string => {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);

  if (seconds < 60) return "just now";

  /*
   * How many of each unit make up the next one.
   *
   * The first version paired each unit with the wrong divisor — it divided
   * minutes by 24 to get hours, and hours by 7 to get days — so every error
   * compounded into the next step and one day came out as "2 weeks ago". Every
   * timestamp in the product was wrong, and wrong in the direction that makes
   * recent work look abandoned.
   *
   * Each entry now reads as "there are N of the previous unit in one of these",
   * which is the sentence the arithmetic has to match.
   */
  const scales: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"], // 60 seconds in a minute
    [60, "hour"], // 60 minutes in an hour
    [24, "day"], // 24 hours in a day
    [7, "week"], // 7 days in a week
    [4.348, "month"], // and about 4.35 weeks in a month
    [12, "year"], // 12 months in a year
  ];

  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  for (const [per, next] of scales) {
    if (value < per) break;

    value /= per;
    unit = next;
  }

  // `numeric: "auto"` so one day is "yesterday" rather than "1 day ago".
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.round(value), unit);
};

/** The second line of a register entry: what it is made of, and its readiness. */
export const describeDocument = (document: DocumentEntry, now?: number): string => {
  const parts: string[] = [];
  const size = formatBytes(document.byteSize);

  if (size) parts.push(size);

  if (document.status === "ready") {
    parts.push(`${document.chunkCount.toLocaleString()} passages`);
    if (document.indexedAt) parts.push(`indexed ${formatWhen(document.indexedAt, now)}`);
  } else if (document.status === "failed") {
    parts.push(document.error ?? "could not be read");
  } else if (document.expectedChunks) {
    parts.push(`${document.chunkCount} of ${document.expectedChunks} passages`);
  } else {
    parts.push("reading");
  }

  return parts.join(" · ");
};

/**
 * Whether a document has stopped moving.
 *
 * `updated_at` is bumped by every write the worker makes, so a document that is
 * not ready and has not been touched for a while is stuck rather than slow.
 * Without this, retry was offered on a document that was visibly making
 * progress — the offer read as "this is broken" while it was working.
 */
export const STALLED_AFTER_MS = 90_000;

export const hasStalled = (document: DocumentEntry, now = Date.now()): boolean =>
  document.status !== "ready" &&
  document.status !== "failed" &&
  now - Date.parse(document.updatedAt) > STALLED_AFTER_MS;

/**
 * A true fraction, or null where none exists yet. The extractor records an
 * expected chunk count before embedding starts precisely so this is possible,
 * and a bar that invents a number is worse than no bar.
 */
export const indexingFraction = (document: DocumentEntry): number | null => {
  if (document.status === "ready") return 1;
  if (!document.expectedChunks) return null;

  return Math.min(1, document.chunkCount / document.expectedChunks);
};
