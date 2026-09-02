"use client";

import { useActionState } from "react";
import { deleteDocument } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { describeDocument, kindLabel } from "@/ui/components/documents/document.format";

/**
 * Every document, with the one destructive act this product has beside each.
 *
 * Deleting a document cascades: its passages, its rows, its files, and the
 * citations pointing at it. That last one used to be impossible — the citation
 * foreign key was `on delete set null` against a check constraint that required
 * it, so a cited document could never be deleted at all.
 */
export const DocumentShelf = ({ documents }: { documents: DocumentEntry[] }) => {
  const [state, remove] = useActionState<ActionState, FormData>(deleteDocument, emptyActionState);

  if (documents.length === 0) {
    return (
      <p className="border-rule border-y py-6 font-light font-reading text-[1.05rem] text-soft">
        Nothing indexed yet.
      </p>
    );
  }

  return (
    <>
      <ul className="m-0 list-none p-0">
        {documents.map((document) => (
          <li
            key={document.id}
            className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-rule border-b py-3"
          >
            <span className="font-record text-label text-faint uppercase tracking-[0.1em]">
              {kindLabel[document.kind]}
            </span>
            <span className="min-w-0 font-light font-reading text-[1.02rem] text-ink">
              <span className="block truncate">{document.title}</span>
              <span className="mt-0.5 block font-record text-label text-faint">
                {describeDocument(document)}
              </span>
            </span>

            {/* A form per row rather than one form with a hidden id swapped by
                a click handler: the row that submits is the row that carries
                the id, so there is no state to get wrong. */}
            <form action={remove}>
              <input type="hidden" name="documentId" value={document.id} />
              <button
                type="submit"
                className="min-h-11 justify-self-end border-rule border-b pb-0.5 font-record text-label text-faint hover:text-danger"
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      {state.error ? (
        <p role="alert" className="mt-3 font-record text-label text-danger">
          {state.error}
        </p>
      ) : null}
    </>
  );
};
