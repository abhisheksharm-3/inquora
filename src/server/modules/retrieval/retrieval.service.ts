import { AppError } from "@/core/errors";
import { mmr } from "@/core/retrieval/mmr";
import type { Candidate } from "@/core/retrieval/mmr.types";
import { err, ok } from "@/core/result";
import { embeddingKey } from "@/server/platform/cache/cache";
import { EMBEDDING_TTL_SECONDS } from "@/server/platform/embeddings/embeddings.constants";
import { MMR_LAMBDA } from "@/core/retrieval/retrieval.constants";
import { withSpan } from "@/server/platform/telemetry/span";
import type { RetrievalRequest } from "./retrieval.schema";
import type { RetrievalDependencies, RetrievalService } from "./retrieval.types";

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
}: RetrievalDependencies): RetrievalService => ({
  async retrieve({ query, documentIds, limit }) {
    return withSpan("retrieval", { documents: documentIds.length, limit }, async (span) => {
      const key = await embeddingKey(query);
      const cached = await cache.get<number[]>(key);

      span.set({ embedding_cached: Boolean(cached) });

      let vector = cached;

      if (!vector) {
        const embedded = await withSpan("embedding", { texts: 1 }, () => embeddings.embed([query]));
        if (!embedded.ok) return err(embedded.error);

        vector = embedded.value[0];
        await cache.set(key, vector, EMBEDDING_TTL_SECONDS);
      }

      const found = await repository.search({ documentIds, embedding: vector, query, limit });
      if (!found.ok) return err(found.error);

      span.set({ candidates: found.value.length });

      if (found.value.length === 0) {
        return err(AppError.notFound("no passage in these documents matched the question"));
      }

      const candidates: Candidate[] = found.value.map((chunk) => ({
        id: chunk.chunkId,
        embedding: chunk.embedding,
        score: chunk.score,
      }));

      const kept = new Set(mmr(candidates, { lambda: MMR_LAMBDA, limit }).map((c) => c.id));
      const chosen = found.value.filter((chunk) => kept.has(chunk.chunkId));

      span.set({ returned: chosen.length });

      return ok(chosen);
    });
  },
});
