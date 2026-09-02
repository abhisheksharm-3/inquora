import { strFromU8, unzipSync } from "fflate";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";

/**
 * A .pptx is a zip of XML, one part per slide, and the text lives in <a:t>
 * elements, so it needs an unzipper rather than an Office parser.
 *
 * fflate rather than jszip: jszip last shipped in 2022 and is several times
 * larger and slower at the one thing needed here, which is reading a handful of
 * entries out of a zip already in memory.
 *
 * Slides are kept whole: a slide is already the unit its author chose, and
 * splitting one across chunks separates a heading from the point it introduces.
 */

const SLIDE_PART = /^ppt\/slides\/slide(\d+)\.xml$/;
const TEXT_ELEMENT = /<a:t>([\s\S]*?)<\/a:t>/g;

const unescapeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export const extractSlides = async (
  bytes: Uint8Array,
): Promise<Result<{ slides: { number: number; text: string }[] }, AppError>> => {
  let entries: Record<string, Uint8Array>;

  try {
    // Only the slide parts are inflated; the media and the theme are skipped
    // rather than decompressed and thrown away.
    entries = unzipSync(bytes, { filter: (file) => SLIDE_PART.test(file.name) });
  } catch {
    return err(AppError.badRequest("that file could not be read as a presentation"));
  }

  const parts = Object.keys(entries)
    .map((name) => ({ name, match: SLIDE_PART.exec(name) }))
    .filter((part): part is { name: string; match: RegExpExecArray } => part.match !== null)
    // Numerically, so slide 10 follows slide 9 rather than slide 1.
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

  if (parts.length === 0) {
    return err(AppError.badRequest("that presentation has no slides"));
  }

  const slides: { number: number; text: string }[] = [];

  for (const part of parts) {
    const xml = strFromU8(entries[part.name]);
    const text = [...xml.matchAll(TEXT_ELEMENT)]
      .map((match) => unescapeXml(match[1]).trim())
      .filter(Boolean)
      .join("\n");

    if (text.length > 0) slides.push({ number: Number(part.match[1]), text });
  }

  if (slides.length === 0) {
    return err(AppError.badRequest("that presentation has no readable text"));
  }

  return ok({ slides });
};
