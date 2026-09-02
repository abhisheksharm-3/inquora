import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "./documents.constants";

/** Kinds the product ingests. Mirrors the document_kind enum. */
export const documentKind = z.enum([
  "pdf",
  "doc",
  "sheet",
  "slides",
  "image",
  "video",
  "github",
  "web",
]);

/**
 * Asking for somewhere to put a file. The bytes never pass through the server:
 * the client uploads them straight to storage with the returned URL, which is
 * what removes the 15MB body limit contradicting a 50MB file limit.
 */
export const uploadRequest = z.object({
  /**
   * A name, not a path. The storage key is `<user id>/<hash>/<filename>`, so a
   * separator or a `..` segment in here would resolve outside the owner's folder
   * — and the worker downloads that key with the service-role client, which
   * bypasses storage policies entirely.
   */
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^/\\]+$/, "a filename cannot contain a path separator")
    .refine((name) => name !== "." && name !== "..", "that is not a filename"),
  kind: documentKind,
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES, "files are limited to 50MB"),
  /** SHA-256 of the bytes, computed by the client, so a duplicate is caught before it is sent. */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export type UploadRequest = z.infer<typeof uploadRequest>;
export type DocumentKind = z.infer<typeof documentKind>;
