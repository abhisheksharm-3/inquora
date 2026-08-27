import { z } from "zod";

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
  filename: z.string().min(1).max(255),
  kind: documentKind,
  byteSize: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024, "files are limited to 50MB"),
  /** SHA-256 of the bytes, computed by the client, so a duplicate is caught before it is sent. */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export type UploadRequest = z.infer<typeof uploadRequest>;
