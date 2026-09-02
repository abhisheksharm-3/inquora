import { AppError } from "@/core/errors";
import { err, type Result } from "@/core/result";
import { createServerDbClient } from "@/server/platform/db/client";
import { rateLimiter } from "@/server/platform/ratelimit/redis";
import { createDocumentsService } from "./documents.service";
import type { UploadTicket } from "./documents.types";
import type { UploadRequest } from "./documents.schema";

/**
 * One upload ticket, rate limited. The handler stays transport-only, so the
 * limiter and the database client are wired here rather than there.
 */
export const requestUploadTicket = async (
  request: UploadRequest,
): Promise<Result<UploadTicket, AppError>> => {
  const db = await createServerDbClient();

  const { data } = await db.auth.getUser();
  if (!data.user) return err(AppError.unauthorized("sign in to upload a document"));

  const allowed = await rateLimiter().check("uploads", data.user.id);
  if (!allowed.ok) return err(allowed.error);

  return createDocumentsService(db, data.user.id).requestUpload(request);
};
