import type { DocumentKind } from "@/core/documents/kind";
import type { PassageInContext } from "@/core/workspace/workspace.types";
import type { UploadTicket } from "@/server/modules/documents/documents.types";

/**
 * What a `useActionState` form on a signed-in surface renders. Empty means the
 * action succeeded and said nothing, which is the common case: the change is
 * visible in the list the action expired.
 */
export type ActionState = {
  /** Cause and next action, shown beside the thing that failed. */
  error?: string;
  /** What happened, when it is worth saying. */
  message?: string;
};

export const emptyActionState: ActionState = {};

/** What the viewer gets when a citation is followed. */
export type PassageState = { passage?: PassageInContext; error?: string };

/** What the upload hook asks for, computed in the browser before any bytes move. */
export type UploadRequestInput = {
  filename: string;
  kind: DocumentKind;
  byteSize: number;
  contentHash: string;
};

export type UploadTicketState = { ticket?: UploadTicket; error?: string };

/** Where one file has got to, for the ingestion log. */
export type UploadProgress = {
  filename: string;
  /** hashing and uploading happen in the browser; indexing happens in the worker. */
  phase: "hashing" | "uploading" | "queued" | "indexing" | "ready" | "failed" | "duplicate";
  /** 0 to 1 where a real fraction exists, and undefined where none does. */
  fraction?: number;
  documentId?: string;
  error?: string;
};
