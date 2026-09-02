"use client";

import { useCallback, useState } from "react";
import { requestUpload } from "@/app/(app)/actions";
import type { UploadProgress } from "@/app/(app)/app.types";
import { contentHash } from "@/core/documents/content-hash";
import { ACCEPTED_DESCRIPTION, kindForFilename } from "@/core/documents/kind";

/**
 * Adding a file, in the order the work actually happens: hash it here, ask the
 * server where to put it, PUT the bytes straight to storage, and let the
 * database's own broadcast report the indexing.
 *
 * The bytes never pass through a route handler. A serverless function has a
 * 4.5MB body limit against a 50MB file limit, so an upload through the server
 * was a contradiction rather than a slow path.
 *
 * The hash is computed before anything is sent, which is what makes a
 * re-uploaded file free: the server answers `alreadyIndexed` and no bytes move.
 */
export const useUpload = () => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const patch = useCallback((filename: string, next: Partial<UploadProgress>) => {
    setUploads((current) =>
      current.map((upload) => (upload.filename === filename ? { ...upload, ...next } : upload)),
    );
  }, []);

  const add = useCallback(
    async (files: File[]) => {
      setUploads((current) => [
        ...files.map((file): UploadProgress => ({ filename: file.name, phase: "hashing" })),
        ...current,
      ]);

      // Sequential on purpose. Four 40MB files hashed at once means four 40MB
      // ArrayBuffers resident, which is where a browser tab dies.
      for (const file of files) {
        const kind = kindForFilename(file.name);

        if (!kind) {
          patch(file.name, {
            phase: "failed",
            error: `Inquora does not read that kind of file. ${ACCEPTED_DESCRIPTION}`,
          });
          continue;
        }

        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const hash = await contentHash(bytes);

          patch(file.name, { phase: "uploading", fraction: 0 });

          const ticket = await requestUpload({
            filename: file.name,
            kind,
            byteSize: file.size,
            contentHash: hash,
          });

          if (ticket.error || !ticket.ticket) {
            patch(file.name, { phase: "failed", error: ticket.error ?? "Could not start." });
            continue;
          }

          if (ticket.ticket.alreadyIndexed) {
            patch(file.name, {
              phase: "duplicate",
              fraction: 1,
              documentId: ticket.ticket.documentId,
            });
            continue;
          }

          const put = await fetch(ticket.ticket.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "content-type": file.type || "application/octet-stream" },
          });

          if (!put.ok) {
            patch(file.name, {
              phase: "failed",
              error: `Storage refused the upload (${put.status}). Try again.`,
            });
            continue;
          }

          // Queued, not ready. What happens next belongs to the worker, and the
          // register hears about it by broadcast rather than by this hook
          // polling for it.
          patch(file.name, { phase: "queued", fraction: 1, documentId: ticket.ticket.documentId });
        } catch (error) {
          patch(file.name, {
            phase: "failed",
            error: error instanceof Error ? error.message : "Could not read the file.",
          });
        }
      }
    },
    [patch],
  );

  const dismiss = useCallback((filename: string) => {
    setUploads((current) => current.filter((upload) => upload.filename !== filename));
  }, []);

  return { uploads, add, dismiss };
};
