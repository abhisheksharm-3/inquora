import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Database } from "@/core/database.types";
import { MAX_FILE_LINES, MAX_TRANSCRIPT_SECONDS } from "@/server/modules/chat/chat.constants";
import type { FileSlice, SliceRepository, TranscriptSegment } from "./documents.types";

/**
 * A file of a repository, and a segment of a transcript.
 *
 * Both read chunk metadata, and both do it in the database, so no caller has to
 * know that the path is a jsonb key or that a range has to overlap rather than
 * contain.
 */
export const createSliceRepository = (db: SupabaseClient<Database>): SliceRepository => ({
  async file({ documentId, path, fromLine, toLine }) {
    const { data, error } = await db.rpc("read_document_file", {
      p_document_id: documentId,
      p_path: path,
      p_from_line: fromLine ?? 1,
      p_to_line: toLine ?? MAX_FILE_LINES,
    });

    if (error) return err(AppError.badGateway(`could not read that file: ${error.message}`));

    return ok(
      (data ?? []).map((row): FileSlice => ({
        path: row.path,
        content: row.content ?? "",
        fromLine: row.from_line,
        toLine: row.to_line,
        lineCount: row.line_count,
      })),
    );
  },

  async transcript({ documentId, startSeconds, endSeconds }) {
    const { data, error } = await db.rpc("read_document_transcript", {
      p_document_id: documentId,
      p_start_s: startSeconds ?? 0,
      p_end_s: endSeconds ?? MAX_TRANSCRIPT_SECONDS,
    });

    if (error) return err(AppError.badGateway(`could not read that segment: ${error.message}`));

    return ok(
      (data ?? []).map((row): TranscriptSegment => ({
        chunkIndex: row.chunk_index,
        content: row.content,
        startSeconds: row.start_s,
        endSeconds: row.end_s,
      })),
    );
  },
});
