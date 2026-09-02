"use client";

import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { describeDocument, kindLabel } from "./document.format";

/**
 * The register: kind, name, what it is made of and readiness on one line. Not a
 * grid of cards, which is the lazy answer and would put four documents where
 * twelve fit.
 */
export const DocumentList = ({
  documents,
  selected,
  onToggle,
}: {
  documents: DocumentEntry[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) => (
  <ul className="m-0 mb-6 list-none p-0">
    {documents.map((document) => (
      <RegisterEntry
        key={document.id}
        document={document}
        selected={selected.has(document.id)}
        onToggle={() => onToggle(document.id)}
      />
    ))}
  </ul>
);

/**
 * A whole entry is the target, not a 16px checkbox beside it. The checkbox is
 * still the control, so the keyboard and a screen reader get a checkbox, and the
 * label wraps the line.
 */
const RegisterEntry = ({
  document,
  selected,
  onToggle,
}: {
  document: DocumentEntry;
  selected: boolean;
  onToggle: () => void;
}) => {
  const usable = document.status === "ready";

  return (
    <li>
      <label
        className={`grid min-h-11 cursor-pointer grid-cols-[26px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-rule border-b px-1 py-3 has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-mark has-focus-visible:outline-offset-2 ${
          selected ? "bg-wash" : ""
        } ${usable ? "" : "cursor-not-allowed"}`}
      >
        <input
          type="checkbox"
          name="document"
          value={document.id}
          checked={selected}
          disabled={!usable}
          onChange={onToggle}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`font-record text-label uppercase tracking-[0.1em] ${
            selected ? "text-mark" : "text-faint"
          }`}
        >
          {kindLabel[document.kind]}
        </span>
        <span className="min-w-0 font-light font-reading text-[1.06rem] text-ink">
          <span className="block truncate">{document.title}</span>
          <span className="mt-0.5 block font-record text-label text-faint">
            {describeDocument(document)}
          </span>
        </span>
        <span
          className={`text-right font-record text-label ${
            document.status === "failed" ? "text-danger" : "text-soft"
          }`}
        >
          {selected ? "selected" : document.status === "ready" ? "ready" : document.status}
        </span>
      </label>
    </li>
  );
};
