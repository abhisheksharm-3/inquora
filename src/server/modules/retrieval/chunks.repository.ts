import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { RetrievedChunk } from "./retrieval.schema";
import type { ChunksRepository } from "./retrieval.types";
import { MAX_CHUNK_RANGE } from "@/server/modules/chat/chat.constants";

/**
 * Consecutive passages by position, which is what the model needs when a search
 * hit is cut off mid-sentence. Plain table reads: no vector involved, and RLS
 * still applies because the client is the caller's.
 */
export const createChunksRepository = (db: SupabaseClient<Database>): ChunksRepository => ({
  async range({ documentId, from, to }) {
    const upper = Math.min(to, from + MAX_CHUNK_RANGE - 1);

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
