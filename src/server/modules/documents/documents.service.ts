import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import type { Database } from "@/core/database.types";
import type { UploadRequest } from "./documents.schema";
import type { DocumentsService, UploadTicket } from "./documents.types";
import { STORAGE_BUCKET } from "@/server/modules/documents/documents.constants";

/**
 * Creates the document row and a signed URL to upload its bytes to.
 *
 * Two things fall out of doing it this way. The bytes never touch a server
 * action, so the 15MB body limit that contradicted the 50MB file limit is gone.
 * And the row exists before the upload, so the insert trigger has already
 * enqueued the ingestion job by the time the file lands.
 */
export const createDocumentsService = (
  db: SupabaseClient<Database>,
  userId: string,
): DocumentsService => ({
  async requestUpload(request: UploadRequest): Promise<Result<UploadTicket, AppError>> {
    // Re-uploading the same bytes reuses the existing chunks rather than paying
    // to embed them again. The unique index enforces it; this reports it.
    const { data: existing, error: lookupError } = await db
      .from("documents")
      .select("id, status, storage_path")
      .eq("user_id", userId)
      .eq("content_hash", request.contentHash)
      .maybeSingle();

    if (lookupError) {
      return err(AppError.badGateway(`could not check for a duplicate: ${lookupError.message}`));
    }

    // Only a finished document is a duplicate. The first version short-circuited
    // on any existing row, so an upload whose PUT never completed came back with
    // an empty uploadUrl and no way to retry: the hash matched forever and the
    // document could never be filled in.
    if (existing?.status === "ready") {
      return ok({
        documentId: existing.id,
        uploadUrl: "",
        path: existing.storage_path ?? "",
        alreadyIndexed: true,
      });
    }

    const path = `${userId}/${request.contentHash}/${request.filename}`;

    if (existing) {
      const resumed = await db.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(existing.storage_path ?? path, { upsert: true });

      if (resumed.error) {
        return err(AppError.badGateway(`could not sign the upload: ${resumed.error.message}`));
      }

      // Back to pending, which the requeue trigger turns into a fresh job.
      await db.from("documents").update({ status: "pending", error: null }).eq("id", existing.id);

      return ok({
        documentId: existing.id,
        uploadUrl: resumed.data.signedUrl,
        path: existing.storage_path ?? path,
        alreadyIndexed: false,
      });
    }

    const { data: document, error: insertError } = await db
      .from("documents")
      .insert({
        user_id: userId,
        kind: request.kind,
        title: request.filename,
        byte_size: request.byteSize,
        content_hash: request.contentHash,
        storage_path: path,
      })
      .select("id")
      .single();

    if (insertError) {
      return err(AppError.badGateway(`could not create the document: ${insertError.message}`));
    }

    const { data: signed, error: signError } = await db.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(path);

    if (signError) {
      return err(AppError.badGateway(`could not sign the upload: ${signError.message}`));
    }

    return ok({
      documentId: document.id,
      uploadUrl: signed.signedUrl,
      path,
      alreadyIndexed: false,
    });
  },
});
