"use client";

import { useEffect, useRef, useState } from "react";
import { findDocuments } from "@/app/(app)/actions";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { kindLabel } from "@/ui/components/documents/document.format";

/**
 * Finding a document to bring into a question.
 *
 * The home screen lists three documents, so with forty of them the ninth was
 * unreachable: the only way to ask about it was to go to settings, which cannot
 * ask anything. This is the way to it.
 *
 * Searched in Postgres rather than in the browser. Filtering a downloaded list
 * would mean fetching every document somebody owns on every visit, and it stops
 * working at exactly the point the feature becomes necessary.
 */
export const DocumentPicker = ({
  chosen,
  onChoose,
  onClose,
}: {
  chosen: ReadonlySet<string>;
  onChoose: (document: DocumentEntry) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.focus(), []);

  // Debounced, so typing eight characters is one query rather than eight, and
  // aborted by the flag so a slow earlier answer cannot overwrite a later one.
  useEffect(() => {
    const term = query.trim();

    if (term.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let current = true;

    const timer = setTimeout(async () => {
      const found = await findDocuments(term);

      if (!current) return;

      setResults(found);
      setSearching(false);
    }, 220);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="border-rule border-t px-5 py-4">
      <label htmlFor="find-document" className="sr-only">
        Find a document to read
      </label>

      <div className="flex items-center gap-3">
        <input
          id="find-document"
          ref={field}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
          placeholder="Find a document by name"
          className="h-9 w-full min-w-0 border-0 border-rule border-b bg-transparent px-0 font-light font-reading text-[1rem] text-ink caret-mark placeholder:text-faint focus-visible:border-mark focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="h-9 shrink-0 font-record text-label text-faint uppercase tracking-[0.12em] hover:text-ink"
        >
          Done
        </button>
      </div>

      {query.trim().length > 0 ? (
        <ul className="m-0 mt-3 list-none p-0" aria-live="polite">
          {searching ? (
            <li className="py-2 font-record text-label text-faint">Looking</li>
          ) : results.length === 0 ? (
            <li className="py-2 font-record text-label text-faint">
              Nothing ready matches that. A document still being read cannot be searched yet.
            </li>
          ) : (
            results.map((document) => {
              const already = chosen.has(document.id);

              return (
                <li key={document.id} className="border-rule border-b last:border-b-0">
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => onChoose(document)}
                    className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 text-left disabled:opacity-50"
                  >
                    <span className="font-record text-label text-faint uppercase tracking-[0.1em]">
                      {kindLabel[document.kind]}
                    </span>
                    <span className="min-w-0 truncate font-light font-reading text-[1rem] text-ink">
                      {document.title}
                    </span>
                    <span className="font-record text-label text-faint">
                      {already ? "already reading" : <span className="text-mark">Add</span>}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
};
