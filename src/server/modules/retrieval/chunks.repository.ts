import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { RetrievedChunk } from "./retrieval.schema";

export interface ChunksRepository {
  range(args: {
    documentId: string;
    from: number;
    to: number;
  }): Promise<Result<RetrievedChunk[], AppError>>;
}

/** How many consecutive passages one read may return, so a tool call cannot pull a whole book. */
const MAX_RANGE = 20;

/**
 * Consecutive passages by position, which is what the model needs when a search
 * hit is cut off mid-sentence. Plain table reads: no vector involved, and RLS
 * still applies because the client is the caller's.
 */
export const createChunksRepository = (db: SupabaseClient<Database>): ChunksRepository => ({
  async range({ documentId, from, to }) {
    const upper = Math.min(to, from + MAX_RANGE - 1);

    const { data, error } = await db
      .from("document_chunks")
      .select("id, document_id, chunk_index, content, metadata")
      .eq("document_id", documentId)
      .gte("chunk_index", from)
      .lte("chunk_index", upper)
      .order("chunk_index");

    if (error) return err(AppError.badGateway(`could not read those passages: ${error.message}`));

    return ok(
      (data ?? []).map((row) => ({
        chunkId: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        score: 0,
        embedding: [],
      })),
    );
  },
});
