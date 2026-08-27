import { AppError } from "@/core/errors";
import { mmr, type Candidate } from "@/core/mmr";
import { err, ok, type Result } from "@/core/result";
import { EMBEDDING_TTL_SECONDS, embeddingKey, type Cache } from "@/server/platform/cache/cache";
import type { RetrievalRepository } from "./retrieval.repository";
import type { RetrievalRequest, RetrievedChunk } from "./retrieval.schema";

/** Relevance-dominant, per the design. */
const MMR_LAMBDA = 0.3;

interface Dependencies {
  embeddings: { embed(texts: string[]): Promise<Result<number[][], AppError>> };
  repository: RetrievalRepository;
  cache: Cache;
}

export interface RetrievalService {
  retrieve(request: RetrievalRequest): Promise<Result<RetrievedChunk[], AppError>>;
}

/**
 * One embedding call, one search call, then ranking in process.
 *
 * The old path made four to eight embedding calls and the same number of vector
 * store roundtrips for a single question, because query expansion, decomposition
 * and step-back each embedded their own rewrite. Hybrid search with rank fusion
 * covers what those approximated.
 */
export const createRetrievalService = ({
  embeddings,
  repository,
  cache,
}: Dependencies): RetrievalService => ({
  async retrieve({ query, documentIds, limit }) {
    const key = await embeddingKey(query);
    const cached = await cache.get<number[]>(key);

    let vector = cached;

    if (!vector) {
      const embedded = await embeddings.embed([query]);
      if (!embedded.ok) return err(embedded.error);

      vector = embedded.value[0];
      await cache.set(key, vector, EMBEDDING_TTL_SECONDS);
    }

    const found = await repository.search({ documentIds, embedding: vector, query, limit });
    if (!found.ok) return err(found.error);

    if (found.value.length === 0) {
      return err(AppError.notFound("no passage in these documents matched the question"));
    }

    const candidates: Candidate[] = found.value.map((chunk) => ({
      id: chunk.chunkId,
      embedding: chunk.embedding,
      score: chunk.score,
    }));

    const kept = new Set(mmr(candidates, { lambda: MMR_LAMBDA, limit }).map((c) => c.id));

    return ok(found.value.filter((chunk) => kept.has(chunk.chunkId)));
  },
});
