import type { UploadProgress } from "@/app/(app)/app.types";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";
import { indexingFraction } from "./document.format";

/**
 * The ingestion log: what has happened to each file being added, as operations
 * with a real state rather than one spinner standing in for four steps.
 *
 * The browser knows about hashing and uploading because it does them. Indexing
 * belongs to the worker, so that half is read from the document row the
 * database broadcasts, which is why the fraction is true rather than animated.
 */
export const ingestionEntries = (
  uploads: UploadProgress[],
  documents: DocumentEntry[],
): Entry[] => {
  const byId = new Map(documents.map((document) => [document.id, document]));

  return uploads.flatMap((upload): Entry[] => {
    const document = upload.documentId ? byId.get(upload.documentId) : undefined;

    if (upload.phase === "failed") {
      return [
        {
          kind: "operation",
          tick: "!",
          title: `${upload.filename} failed`,
          detail: upload.error ?? "Could not be added.",
        },
      ];
    }

    if (upload.phase === "duplicate") {
      return [
        {
          kind: "operation",
          tick: "✓",
          title: `${upload.filename} was already indexed`,
          detail: "Same bytes, same passages. Nothing was uploaded and nothing was charged.",
        },
      ];
    }

    if (!document) {
      return [
        {
          kind: "operation",
          tick: "·",
          title: upload.filename,
          detail: upload.phase === "hashing" ? "reading the file" : "uploading to storage",
        },
      ];
    }

    const fraction = indexingFraction(document);

    if (document.status === "failed") {
      return [
        {
          kind: "operation",
          tick: "!",
          title: `${document.title} failed`,
          detail: document.error ?? "The extractor could not read it.",
        },
      ];
    }

    if (document.status === "ready") {
      return [
        {
          kind: "operation",
          tick: "✓",
          title: `${document.title} is ready`,
          detail: `${document.chunkCount.toLocaleString()} passages, all embedded.`,
        },
      ];
    }

    return [
      {
        kind: "operation",
        tick: "·",
        title: document.title,
        detail:
          document.expectedChunks === null
            ? `${document.status}, no passage count yet`
            : `embedding ${document.chunkCount} of ${document.expectedChunks}${
                fraction === null ? "" : ` · ${Math.round(fraction * 100)}%`
              }`,
      },
    ];
  });
};
