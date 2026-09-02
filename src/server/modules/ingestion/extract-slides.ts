import JSZip from "jszip";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

/**
 * A .pptx is a zip of XML, one part per slide, and the text lives in <a:t>
 * elements. Reading it takes the zip library already installed rather than an
 * Office parser.
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
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return err(AppError.badRequest("that file could not be read as a presentation"));
  }

  const parts = Object.keys(zip.files)
    .map((name) => ({ name, match: SLIDE_PART.exec(name) }))
    .filter((part): part is { name: string; match: RegExpExecArray } => part.match !== null)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

  if (parts.length === 0) {
    return err(AppError.badRequest("that presentation has no slides"));
  }

  const slides: { number: number; text: string }[] = [];

  for (const part of parts) {
    const xml = await zip.files[part.name].async("string");
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
