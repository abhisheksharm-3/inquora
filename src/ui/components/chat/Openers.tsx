import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { openersFor } from "@/ui/components/documents/openers";

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
