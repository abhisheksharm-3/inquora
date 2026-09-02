import type { DocumentEntry } from "@/core/workspace/workspace.types";

/**
 * Surface 05, where the personality lives. Openers generated from the documents
 * in scope, not generic prompts: a spreadsheet gets asked about figures, a
 * repository about where something is implemented, a video about what was said.
 *
 * Generic suggestions are worse than none, because they teach the reader that
 * the product does not know what it is holding.
 */
export const Openers = ({
  documents,
  onPick,
}: {
  documents: DocumentEntry[];
  onPick: (question: string) => void;
}) => {
  const openers = openersFor(documents);

  return (
    <div className="flex-1 py-10">
      <div className="max-w-[40ch]">
        <p className="mb-4 font-record text-label text-faint uppercase tracking-[0.14em]">
          {documents.length === 0
            ? "Nothing attached"
            : `${documents.length} document${documents.length === 1 ? "" : "s"} in scope`}
        </p>
        <h2 className="mb-3.5 font-light font-reading text-[1.9rem] leading-snug">
          {documents.length === 0
            ? "There is nothing to read yet."
            : "Ask something you would have to look up."}
        </h2>
        <p className="mb-6 max-w-[36ch] font-record text-[0.85rem] text-soft">
          {documents.length === 0
            ? "Add a document to this conversation and its openers appear here."
            : "Every answer names the passage it came from, and one click opens it."}
        </p>

        {openers.length > 0 ? (
          <ul className="m-0 grid list-none gap-px border border-rule bg-rule p-0">
            {openers.map((opener, index) => (
              <li key={opener} className="bg-ground">
                <button
                  type="button"
                  onClick={() => onPick(opener)}
                  className="flex min-h-11 w-full items-baseline gap-2.5 px-3.5 py-2.5 text-left font-light font-reading text-[0.95rem] text-soft hover:text-ink"
                >
                  <b className="font-medium font-record text-[0.6rem] text-mark tabular">
                    {String(index + 1).padStart(2, "0")}
                  </b>
                  {opener}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Three at most. A list of eight suggestions is a menu, and the point is to
 * show what kind of question this set of documents rewards.
 */
const openersFor = (documents: DocumentEntry[]): string[] => {
  const first = documents[0];
  if (!first) return [];

  const openers: string[] = [];
  const has = (kind: DocumentEntry["kind"]) => documents.some((entry) => entry.kind === kind);

  if (has("sheet")) openers.push("Which figures moved most, and by how much?");
  if (has("github")) openers.push("Where is the entry point, and what does it call first?");
  if (has("video")) openers.push("What was decided, and at what point was it said?");
  if (has("slides")) openers.push("What is the argument, slide by slide?");

  openers.push(`What is ${first.title} actually claiming?`);

  if (documents.length > 1) openers.push("Where do these documents disagree?");

  return openers.slice(0, 3);
};
