import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { RetrievedChunk } from "./retrieval.schema";

/**
 * Postgres renders a vector as `[0.1,0.2,...]` text over the wire, so it arrives
 * as a string rather than an array. An unparseable value yields an empty vector,
 * which MMR treats as maximally dissimilar rather than crashing the query.
 */
const parseVector = (value: unknown): number[] => {
  if (Array.isArray(value)) return value as number[];
  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
};

/**
 * MMR can only remove candidates, so the database is asked for a wider set than
 * the caller wants and the pruning happens after.
 */
const CANDIDATE_MULTIPLIER = 3;

/**
 * The only thing in this system that reads chunks for retrieval, and it makes
 * exactly one call. Hybrid search, fusion and the document filter all happen
 * inside `search_chunks`, which is why this is a repository and not an engine:
 * the old `retrieval-engine.ts` was 400 lines orchestrating four roundtrips.
 */
export const createRetrievalRepository = (db: SupabaseClient<Database>): RetrievalRepository => ({
  async search({ documentIds, embedding, query, limit }) {
    const { data, error } = await db.rpc("search_chunks", {
      p_document_ids: documentIds,
      // The generated type is string, because Postgres renders vector as text
      // over the wire.
      p_embedding: JSON.stringify(embedding),
      p_query: query,
      p_limit: limit * CANDIDATE_MULTIPLIER,
    });

    if (error) return err(AppError.badGateway(`search_chunks failed: ${error.message}`));

    return ok(
      (data ?? []).map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        score: row.score,
        embedding: parseVector(row.embedding),
      })),
    );
  },
});
import type { RetrievalRepository, SearchArgs } from "./retrieval.types";
