import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";
import type { UploadRequest } from "./documents.schema";

export interface UploadTicket {
  documentId: string;
  /** Where to PUT the bytes. Expires; it is not a durable link. */
  uploadUrl: string;
  path: string;
  /** True when these exact bytes are already indexed, so there is nothing to upload. */
  alreadyIndexed: boolean;
}

export interface DocumentsService {
  requestUpload(request: UploadRequest): Promise<Result<UploadTicket, AppError>>;
}
