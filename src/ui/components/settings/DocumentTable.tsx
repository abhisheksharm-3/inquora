"use client";

import { useActionState } from "react";
import { deleteDocument, retryDocument } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { formatBytes, hasStalled, kindLabel } from "@/ui/components/documents/document.format";
import { Ago } from "@/ui/components/shared/Ago";

/**
 * Everything you have added, as a table.
 *
 * Columns rather than stacked rows, for the same reason the history page has
 * them: a list is scannable when the answer to one question is always in the
 * same place. The previous version put the size, the passage count and the date
 * in one dim sentence under each name, which reads as prose and compares as
 * nothing.
 *
 * Both actions a document has live here. Retry was impossible from a browser
 * until migration 0034, because `documents.status` is not a client-writable
 * column, and deleting was the only recourse for one that failed.
 */
export const DocumentTable = ({ documents }: { documents: DocumentEntry[] }) => {
  if (documents.length === 0) {
    return (
      <p className="m-0 border-rule border-y py-9 font-light font-reading text-[1.15rem] text-soft">
        Nothing added yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse">
        <thead>
          <tr className="border-rule border-b">
            {["", "Name", "Size", "Passages", "Added", ""].map((heading, index) => (
              <th
                key={heading || index}
                scope="col"
                className="pb-2 pr-6 text-left font-normal font-record text-label text-faint uppercase tracking-[0.13em] last:pr-0"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {documents.map((document) => (
            <Row key={document.id} document={document} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Row = ({ document }: { document: DocumentEntry }) => {
  const [removed, remove] = useActionState<ActionState, FormData>(deleteDocument, emptyActionState);
  const [retried, retry] = useActionState<ActionState, FormData>(retryDocument, emptyActionState);

  const ready = document.status === "ready";
  const canRetry = document.status === "failed" || hasStalled(document);

  return (
    <tr className="border-rule border-b align-baseline">
      <td className="w-[3.5rem] py-3.5 pr-6 font-record text-label text-faint uppercase tracking-[0.1em]">
        {kindLabel[document.kind]}
      </td>

      <td className="py-3.5 pr-6">
        <span className="line-clamp-1 max-w-[40ch] font-light font-reading text-[1.05rem] text-ink">
          {document.title}
        </span>
        {ready ? null : (
          <span
            className={`mt-1 block font-record text-label ${
              document.status === "failed" ? "text-danger" : "text-faint"
            }`}
          >
            {document.status === "failed"
              ? (document.error ?? "could not be read")
              : hasStalled(document)
                ? "stopped part-way"
                : "still being read"}
          </span>
        )}
        {removed.error || retried.error ? (
          <span role="alert" className="mt-1 block font-record text-label text-danger">
            {removed.error ?? retried.error}
          </span>
        ) : null}
      </td>

      <td className="w-[6rem] py-3.5 pr-6 font-record text-label text-faint tabular">
        {formatBytes(document.byteSize) ?? "—"}
      </td>

      <td className="w-[7rem] py-3.5 pr-6 font-record text-label text-faint tabular">
        {ready
          ? document.chunkCount.toLocaleString()
          : document.expectedChunks
            ? `${document.chunkCount} of ${document.expectedChunks}`
            : "—"}
      </td>

      <td className="w-[9rem] py-3.5 pr-6 font-record text-label text-faint">
        {document.indexedAt ? <Ago iso={document.indexedAt} /> : <Ago iso={document.createdAt} />}
      </td>

      <td className="w-[10rem] py-3.5 text-right">
        <span className="inline-flex items-baseline gap-4">
          {canRetry ? (
            <form action={retry} className="inline">
              <input type="hidden" name="documentId" value={document.id} />
              <button
                type="submit"
                className="whitespace-nowrap border-mark border-b font-record text-label text-mark hover:bg-wash"
              >
                Read again
              </button>
            </form>
          ) : null}

          <form action={remove} className="inline">
            <input type="hidden" name="documentId" value={document.id} />
            <button
              type="submit"
              className="whitespace-nowrap font-record text-label text-faint hover:text-danger"
            >
              Delete
            </button>
          </form>
        </span>
      </td>
    </tr>
  );
};
