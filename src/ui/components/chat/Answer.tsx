import Link from "next/link";
import type { Specimen } from "@/core/workspace/workspace.types";
import { passageHref } from "./turn-apparatus";

/**
 * A citation, which the model writes as `[3]` and sometimes as `[1, 2, 3]`.
 *
 * The second form was rendered as literal text — an answer citing nine
 * passages printed "[1, 2, 3, 4, 5, 6, 7, 8, 9]" in the middle of a sentence.
 * A group becomes one mark per number.
 */
const MARK = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;

/**
 * The answer, in the reading column: Newsreader at 300, 58 characters, generous
 * leading, no bubble and nothing placed behind it.
 *
 * `[3]` in the text becomes a superscript mark that reaches its specimen, and
 * the specimen's number reaches back. That pair is the only connective tissue
 * between an assertion and the thing that backs it, which is the whole thesis
 * of the product rendered as two anchors.
 *
 * A mark whose specimen has not arrived yet is left as plain text rather than
 * linked to nothing: specimens stream in, so for a few hundred milliseconds the
 * text can be ahead of the apparatus.
 */
export const Answer = ({ text, specimens }: { text: string; specimens: Specimen[] }) => {
  const known = new Map(specimens.map((specimen) => [specimen.number, specimen]));

  return (
    <div className="max-w-measure font-light font-reading text-ink text-read">
      {blocks(text).map((block, index) =>
        // A block has no id of its own and the text is append-only while
        // streaming, so its position is a stable key.
        block.kind === "list" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only streamed text
          <ul key={index} className="mb-4 list-none pl-5">
            {block.items.map((item) => (
              <li key={item} className="relative mb-1.5">
                <span aria-hidden className="-left-5 absolute text-mark">
                  ·
                </span>
                {withMarks(item, known)}
              </li>
            ))}
          </ul>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only streamed text
          <p key={index} className="mb-4">
            {withMarks(block.text, known)}
          </p>
        ),
      )}
    </div>
  );
};

/**
 * Paragraphs and lists, from the plain text the model streams.
 *
 * A model asked for wages month by month answers with markdown bullets, and
 * those were rendered verbatim: "* March 2026: 5804 * April 2026: 15000" in one
 * run-on line. This is deliberately not a markdown parser — no dependency, no
 * tables, no headings, no links — because the two things the answers actually
 * contain are paragraphs and bullet lists, and the citation marks have to
 * survive whatever does the splitting.
 */
type Block = { kind: "text"; text: string } | { kind: "list"; items: string[] };

const BULLET = /^\s*[*\u2022-]\s+/;

const blocks = (text: string): Block[] => {
  const out: Block[] = [];

  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk.split("\n");
    let paragraph: string[] = [];
    let items: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length > 0) out.push({ kind: "text", text: paragraph.join(" ") });
      paragraph = [];
    };

    const flushList = () => {
      if (items.length > 0) out.push({ kind: "list", items });
      items = [];
    };

    for (const line of lines) {
      if (BULLET.test(line)) {
        flushParagraph();
        items.push(line.replace(BULLET, ""));
        continue;
      }

      // A model that writes its bullets on one line, which Gemini does: the
      // first fragment is prose and every " * " after it starts an item.
      const inline = line.split(/\s+\*\s+/);

      if (inline.length > 1) {
        const [lead, ...rest] = inline;
        if (lead.trim()) paragraph.push(lead.trim());
        flushParagraph();
        items.push(...rest.map((item) => item.trim()).filter(Boolean));
        continue;
      }

      flushList();
      if (line.trim()) paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
  }

  return out;
};

/**
 * Split on the citation marks rather than replacing them, so a passage that
 * happens to contain square brackets stays text.
 */
const withMarks = (paragraph: string, known: Map<number, Specimen>): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let last = 0;

  for (const match of paragraph.matchAll(MARK)) {
    const numbers = match[1].split(",").map((part) => Number(part.trim()));
    const at = match.index;

    out.push(paragraph.slice(last, at));
    last = at + match[0].length;

    // Every number in the group that has arrived, each its own mark. A group
    // where none has arrived stays as the model wrote it.
    const found = numbers.map((number) => known.get(number)).filter(Boolean);

    if (found.length === 0) {
      out.push(match[0]);
      continue;
    }

    for (const specimen of found) {
      if (!specimen) continue;
      const number = specimen.number;

      out.push(
        <Link
          key={`${at}-${number}`}
          href={passageHref(specimen.chunkId, number)}
          scroll={false}
          aria-label={`Open passage ${number} from ${specimen.documentTitle}`}
          // No underline under the mark. The mockup underlines the cited phrase,
          // and the model tells us where a citation ends but not where the claim
          // it supports began, so underlining one character would mean nothing.
          className="rounded-hair px-px hover:bg-wash"
        >
          <sup className="ml-0.5 align-[0.42em] font-medium font-record text-[0.58rem] text-mark">
            {number}
          </sup>
        </Link>,
      );
    }
  }

  out.push(paragraph.slice(last));

  return out;
};
