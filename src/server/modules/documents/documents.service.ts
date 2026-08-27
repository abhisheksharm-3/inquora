import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { UploadRequest } from "./documents.schema";

export interface UploadTicket {
  documentId: string;
  /** Where to PUT the bytes. Expires; it is not a durable link. */
  uploadUrl: string;
  path: string;
  /** True when these exact bytes are already indexed, so there is nothing to upload. */
  alreadyIndexed: boolean;
}

const BUCKET = "documents";

/**
 * Creates the document row and a signed URL to upload its bytes to.
 *
 * Two things fall out of doing it this way. The bytes never touch a server
 * action, so the 15MB body limit that contradicted the 50MB file limit is gone.
 * And the row exists before the upload, so the insert trigger has already
 * enqueued the ingestion job by the time the file lands.
 */
export const createDocumentsService = (db: SupabaseClient<Database>, userId: string) => ({
  async requestUpload(request: UploadRequest): Promise<Result<UploadTicket, AppError>> {
    // Re-uploading the same bytes reuses the existing chunks rather than paying
    // to embed them again. The unique index enforces it; this reports it.
    const { data: existing, error: lookupError } = await db
      .from("documents")
      .select("id, status")
      .eq("content_hash", request.contentHash)
      .maybeSingle();

    if (lookupError) {
      return err(AppError.badGateway(`could not check for a duplicate: ${lookupError.message}`));
    }

    if (existing) {
      return ok({
        documentId: existing.id,
        uploadUrl: "",
        path: "",
        alreadyIndexed: existing.status === "ready",
      });
    }

    const path = `${userId}/${request.contentHash}/${request.filename}`;

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
      .from(BUCKET)
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
