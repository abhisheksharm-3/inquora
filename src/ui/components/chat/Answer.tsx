import type { Specimen } from "@/core/workspace/workspace.types";

const MARK = /\[(\d{1,3})\]/g;

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
  const known = new Set(specimens.map((specimen) => specimen.number));

  return (
    <div className="max-w-measure font-light font-reading text-ink text-read">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        // A paragraph has no id of its own and the text is append-only while
        // streaming, so its position is a stable key.
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only streamed text
        <p key={index} className="mb-4">
          {withMarks(paragraph, known)}
        </p>
      ))}
    </div>
  );
};

/**
 * Split on the citation marks rather than replacing them, so a passage that
 * happens to contain square brackets stays text.
 */
const withMarks = (paragraph: string, known: Set<number>): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let last = 0;

  for (const match of paragraph.matchAll(MARK)) {
    const number = Number(match[1]);
    const at = match.index;

    out.push(paragraph.slice(last, at));
    last = at + match[0].length;

    out.push(
      known.has(number) ? (
        <a
          key={`${at}-${number}`}
          href={`#specimen-${number}`}
          aria-label={`Passage ${number}`}
          // No underline under the mark. The mockup underlines the cited phrase,
          // and the model tells us where a citation ends but not where the claim
          // it supports began, so underlining the number alone would draw a rule
          // under one character and mean nothing.
          className="rounded-hair px-px hover:bg-wash"
        >
          <sup className="ml-0.5 align-[0.42em] font-medium font-record text-[0.58rem] text-mark">
            {number}
          </sup>
        </a>
      ) : (
        match[0]
      ),
    );
  }

  out.push(paragraph.slice(last));

  return out;
};
