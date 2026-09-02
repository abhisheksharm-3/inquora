import type { Outline } from "@/core/documents/outline.types";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";
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

/** One sheet of a document, as the model is shown it. */
export interface DocumentTable {
  name: string;
  header: string[];
  rowCount: number;
}

export interface TableQuery {
  documentId: string;
  tableName: string;
  sql: string;
  limit?: number;
}

export interface TablesRepository {
  list(documentId: string): Promise<Result<DocumentTable[], AppError>>;
  query(query: TableQuery): Promise<Result<Record<string, unknown>[], AppError>>;
}

/**
 * One matching line. `path` is set for a repository, where a match belongs to a
 * file, and null for a document that is one body of text.
 */
export interface GrepMatch {
  path: string | null;
  lineNumber: number;
  line: string;
}

export interface GrepQuery {
  documentId: string;
  pattern: string;
  limit?: number;
}

export interface OutlineRepository {
  outline(documentId: string): Promise<Result<Outline | null, AppError>>;
  grep(query: GrepQuery): Promise<Result<GrepMatch[], AppError>>;
}

/**
 * A slice of one file of a repository — the real lines, not the chunks that
 * happened to overlap them.
 */
export interface FileSlice {
  path: string;
  content: string;
  fromLine: number;
  toLine: number;
  /** How long the file is, so the model knows whether it read all of it. */
  lineCount: number;
}

/** A segment of a video transcript, timed so a citation can deep-link. */
export interface TranscriptSegment {
  chunkIndex: number;
  content: string;
  startSeconds: number;
  endSeconds: number;
}

export interface SliceRepository {
  file(args: {
    documentId: string;
    path: string;
    fromLine?: number;
    toLine?: number;
  }): Promise<Result<FileSlice[], AppError>>;
  transcript(args: {
    documentId: string;
    startSeconds?: number;
    endSeconds?: number;
  }): Promise<Result<TranscriptSegment[], AppError>>;
}
