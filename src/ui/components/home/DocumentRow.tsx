"use client";

import { useActionState } from "react";
import { retryDocument } from "@/app/(app)/actions";
import { type ActionState, emptyActionState, type UploadProgress } from "@/app/(app)/app.types";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import {
  describeDocument,
  hasStalled,
  indexingFraction,
  kindLabel,
} from "@/ui/components/documents/document.format";

/**
 * One document, in whatever state it is in.
 *
 * A file being uploaded appears here too, dimmed, with the same shape as
 * everything else. It used to appear in a separate list above this one with its
 * own progress bar and its own vocabulary, so adding a file made a second list
 * of files appear next to the list of files — and the row moved from one to the
 * other when the upload finished, which reads as the document disappearing and
 * a different one arriving.
 *
 * A document that failed or stalled offers to be read again. There was no way
 * to retry at all: `documents.status` is not a client-writable column, so the
 * only recourse was deleting it and adding it back.
 */
export const DocumentRow = ({
  document,
  upload,
  inQuestion,
}: {
  document?: DocumentEntry;
  /** Set while the browser still has work to do: hashing, or uploading. */
  upload?: UploadProgress;
  inQuestion?: boolean;
}) => {
  const [state, retry] = useActionState<ActionState, FormData>(retryDocument, emptyActionState);

  // An upload with no document row yet: hashing, or the bytes are still moving.
  if (!document) {
    if (!upload) return null;

    return (
      <li className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-rule border-b py-3.5 opacity-55">
        <span className="font-record text-label text-faint uppercase tracking-[0.1em]">···</span>
        <span className="min-w-0 font-light font-reading text-[1.05rem] text-ink">
          <span className="block truncate">{upload.filename}</span>
          <span
            className={`mt-1 block font-record text-label ${
              upload.phase === "failed" ? "text-danger" : "text-faint"
            }`}
          >
            {upload.error ?? PHASE[upload.phase]}
          </span>
        </span>
        <span className="text-right font-record text-label text-faint tabular">
          {upload.fraction === undefined ? "" : `${Math.round(upload.fraction * 100)}%`}
        </span>
      </li>
    );
  }

  const fraction = indexingFraction(document);

  // Offered when it failed, or when it stopped moving. Not while it is working:
  // "Read it again" beside a document at 55% and climbing reads as "this is
  // broken", and pressing it throws away the passages already embedded.
  const canRetry = document.status === "failed" || hasStalled(document);

  return (
    <li
      className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-rule border-b py-3.5 ${
        document.status === "ready" ? "" : "opacity-70"
      }`}
    >
      <span className="font-record text-label text-faint uppercase tracking-[0.1em]">
        {kindLabel[document.kind]}
      </span>

      <span className="min-w-0 font-light font-reading text-[1.05rem] text-ink">
        <span className="block truncate">{document.title}</span>
        <span
          className={`mt-1 block font-record text-label ${
            document.status === "failed" ? "text-danger" : "text-faint"
          }`}
        >
          {document.status === "failed"
            ? (document.error ?? "could not be read")
            : describeDocument(document)}
        </span>
        {state.error ? (
          <span role="alert" className="mt-1 block font-record text-label text-danger">
            {state.error}
          </span>
        ) : null}
      </span>

      <span className="flex items-baseline justify-end gap-3 text-right font-record text-label">
        {document.status === "ready" ? (
          <span className="text-faint">
            {inQuestion ? "in this question" : "not in this question"}
          </span>
        ) : (
          <>
            <span className="text-faint">
              {document.status === "failed"
                ? "failed"
                : hasStalled(document)
                  ? "stopped"
                  : "reading it"}
              {fraction !== null && document.status !== "failed" ? (
                <span className="ml-2 tabular">{Math.round(fraction * 100)}%</span>
              ) : null}
            </span>

            {canRetry ? (
              <form action={retry}>
                <input type="hidden" name="documentId" value={document.id} />
                <button
                  type="submit"
                  className="whitespace-nowrap border-mark border-b text-mark hover:bg-wash"
                >
                  {state.message ? "Retrying" : "Read it again"}
                </button>
              </form>
            ) : null}
          </>
        )}
      </span>
    </li>
  );
};

const PHASE: Record<UploadProgress["phase"], string> = {
  hashing: "reading the file",
  uploading: "uploading",
  queued: "queued for reading",
  indexing: "reading it",
  ready: "ready",
  failed: "could not be added",
  duplicate: "already added, nothing to upload",
};
