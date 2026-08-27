import { z } from "zod";
import { EMBEDDING_DIMENSIONS } from "@/server/platform/embeddings/client";

/** What a caller asks for. The document set is explicit: multi-document is an array, not a rebuild. */
export const retrievalRequest = z.object({
  query: z.string().min(1).max(2000),
  documentIds: z.array(z.guid()).min(1),
  /** How many chunks the model finally sees. */
  limit: z.number().int().min(1).max(50).default(12),
});

export type RetrievalRequest = z.infer<typeof retrievalRequest>;

/** One row of `search_chunks`, after MMR. */
export const retrievedChunk = z.object({
  chunkId: z.guid(),
  documentId: z.guid(),
  chunkIndex: z.number().int().min(0),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  score: z.number(),
  /** The chunk's own vector, which is what MMR ranks over. */
  embedding: z.array(z.number()),
});

export type RetrievedChunk = z.infer<typeof retrievedChunk>;

export const embedding = z.array(z.number()).length(EMBEDDING_DIMENSIONS);
