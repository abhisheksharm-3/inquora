import type { DocumentKind } from "@/server/modules/documents/documents.schema";
import type { KindSpecialist } from "./kinds.types";

/**
 * One specialist per document kind.
 *
 * Guidance, not permission: every tool is offered to every conversation and each
 * refuses a document that is not attached. What differs is what the model is told
 * about the shape of content in front of it, which is the difference between a
 * model that greps a spreadsheet and one that queries it.
 *
 * An earlier version also carried a per-kind tool list. Nothing read it — the
 * prompt is composed from the guidance and the caveat — so it was a second,
 * silently ignored description of the same decision.
 */
export const SPECIALISTS: Record<DocumentKind, KindSpecialist> = {
  github: {
    kind: "github",
    label: "a code repository",
    guidance: [
      "Start with get_outline to see the file tree; a repository is a structure before it is text.",
      "For a symbol, an import, a call site or an error string, use grep_document: an identifier is",
      "exactly what a meaning-based search flattens. Then read_file around the match to see the",
      "whole function rather than the fragment that matched. Cite as path:line, and quote code",
      "verbatim rather than paraphrasing it — a paraphrased signature is wrong.",
      "When asked how something works, trace it: entry point, then the functions it calls.",
    ].join(" "),
    caveat:
      "Only indexable source and documentation files are read, up to two thousand of them, so say " +
      "so if something you expect to be in the repository is not there.",
  },

  video: {
    kind: "video",
    label: "a video",
    guidance: [
      "You have the transcript, not the picture. Search it to find where a subject comes up, then",
      "get_transcript around that time to read what was actually said either side of it.",
      "Always give the timestamp with a claim, in seconds or as mm:ss, because a viewer wants to go",
      "there rather than take your word for it. Distinguish what a speaker said from what they",
      "concluded: a transcript records both and they are often different.",
    ].join(" "),
    caveat:
      "Timings come from the subtitle track and are interpolated where the track has none, so a " +
      "timestamp is accurate to a few seconds rather than to the frame. Nothing visual is available: " +
      "if the answer is on a slide that was shown and not read out, say so.",
  },

  sheet: {
    kind: "sheet",
    label: "a spreadsheet",
    guidance: [
      "Query it, do not read it. list_tables for the sheets and their real column names, then",
      "query_table with one SQL select against the view named t, quoting column names exactly.",
      "Cast before comparing or summing, because every cell is stored as text:",
      '"Value"::numeric > 1000, not "Value" > 1000.',
      "Give the number the query returned rather than one you estimated from a passage, and say",
      "which sheet and which rows it came from.",
    ].join(" "),
    caveat:
      "A formula is stored as its last computed result, so a stale workbook gives stale numbers.",
  },

  slides: {
    kind: "slides",
    label: "a slide deck",
    guidance: [
      "Each passage is one slide, numbered. Cite the slide number, because that is how somebody",
      "will find it. A deck argues in sequence, so when a question is about a conclusion, read the",
      "slides either side of the one that matched rather than answering from it alone.",
    ].join(" "),
    caveat: "Speaker notes and anything conveyed by an image on a slide are not available.",
  },

  pdf: {
    kind: "pdf",
    label: "a document",
    guidance: [
      "Search first, then read_chunks either side of a hit when a sentence looks cut off.",
      "get_outline shows the headings, which is faster than searching to find out whether a subject",
      "is covered at all. Quote the passage a claim rests on.",
    ].join(" "),
  },

  doc: {
    kind: "doc",
    label: "a document",
    guidance: [
      "Search first, then read_chunks either side of a hit when a sentence looks cut off.",
      "get_outline shows the headings. Quote the passage a claim rests on.",
    ].join(" "),
  },

  web: {
    kind: "web",
    label: "a web page",
    guidance: [
      "This is the text of the page as it was when it was added, with markup stripped, so",
      "navigation and boilerplate may appear alongside the content. Prefer the passage that reads",
      "like prose over one that reads like a menu.",
    ].join(" "),
    caveat: "The page may have changed since it was indexed.",
  },

  image: {
    kind: "image",
    label: "an image",
    guidance: [
      "What you have is a description of the image and a transcription of any text in it, written",
      "when it was added. Answer from that, and be explicit that you are reading a description",
      "rather than looking at the image, because the description may have missed a detail the",
      "question turns on.",
    ].join(" "),
    caveat: "Fine detail, exact colours and small text may not have survived the description.",
  },
};

/**
 * The specialists for what is actually attached, deduplicated, so a chat holding
 * a repository and a spreadsheet is told about both and nothing else.
 */
export const specialistsFor = (kinds: string[]): KindSpecialist[] => {
  const seen = new Set<string>();

  return kinds
    .filter((kind): kind is DocumentKind => kind in SPECIALISTS)
    .filter((kind) => (seen.has(kind) ? false : seen.add(kind) !== undefined))
    .map((kind) => SPECIALISTS[kind]);
};
