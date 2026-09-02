"use client";

import { useActionState } from "react";
import { createChat } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { describeDocument, indexingFraction, kindLabel } from "./document.format";

/**
 * Your files. One click on a row starts a conversation about that file.
 *
 * The version this replaces asked you to tick boxes and then press Start
 * Reading, which is the `chat_documents` join table talking rather than a
 * person: nobody arrives thinking "I would like to assemble a document set".
 * They arrive with a question about a file. So the row is the action.
 *
 * Asking about several files at once is still there, and it is where it belongs
 * — inside the conversation, on the bar that already lets you switch documents
 * in and out of a question. It is the second thing anybody does, not the first.
 */
export const DocumentList = ({ documents }: { documents: DocumentEntry[] }) => (
  <ul className="m-0 list-none border-rule border-t p-0">
    {documents.map((document) => (
      <Row key={document.id} document={document} />
    ))}
  </ul>
);

const Row = ({ document }: { document: DocumentEntry }) => {
  const [state, open] = useActionState<ActionState, FormData>(createChat, emptyActionState);
  const ready = document.status === "ready";
  const fraction = indexingFraction(document);

  return (
    <li className="border-rule border-b">
      <form action={open}>
        <input type="hidden" name="document" value={document.id} />
        <input type="hidden" name="document-title" value={document.title} />

        <button
          type="submit"
          disabled={!ready}
          className={`grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-baseline gap-x-4 px-1 py-4 text-left transition-colors duration-150 ease-out-quart ${
            ready ? "hover:bg-panel" : "cursor-not-allowed opacity-55"
          }`}
        >
          <span
            aria-hidden
            className="font-record text-label text-faint uppercase tracking-[0.1em]"
          >
            {kindLabel[document.kind]}
          </span>

          <span className="min-w-0 font-light font-reading text-[1.1rem] text-ink">
            <span className="block truncate">{document.title}</span>
            <span className="mt-1 block font-record text-label text-faint">
              {describeDocument(document)}
            </span>
          </span>

          <span
            className={`text-right font-record text-label ${
              document.status === "failed" ? "text-danger" : "text-faint"
            }`}
          >
            {/* What clicking does, on the row that does it, rather than a
                status word that tells you nothing you can act on. */}
            {ready ? (
              <span className="text-mark">Ask about this</span>
            ) : document.status === "failed" ? (
              "could not be read"
            ) : (
              <>
                <span>reading it</span>
                {fraction === null ? null : (
                  <span className="mt-1 block tabular">{Math.round(fraction * 100)}%</span>
                )}
              </>
            )}
          </span>
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="px-1 pb-3 font-record text-label text-danger">
          {state.error}
        </p>
      ) : null}
    </li>
  );
};
