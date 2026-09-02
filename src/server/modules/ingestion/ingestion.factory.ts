import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import { createServiceDbClient } from "@/server/platform/db/service";
import { createEmbeddingsClient } from "@/server/platform/embeddings/client";
import { BATCH_TIMEOUT_MS } from "@/server/platform/embeddings/embeddings.constants";
import { env } from "@/server/platform/env";
import { extractDocument } from "./extract.source";
import { createIngestionRepository } from "./ingestion.repository";
import type { DrainSummary, IngestionWorker } from "./ingestion.types";
import { createIngestionWorker } from "./ingestion.worker";

/**
 * Drains up to `limit` jobs, then returns a summary. The worker itself is pure
 * orchestration over injected pieces; this is where the real ones are chosen.
 */

/**
 * One pass over the queue, given a worker.
 *
 * Separate from the wiring below so the accounting can be tested: a queue
 * worker's normal case is partial success, and what it reports about a partial
 * run is the contract the caller retries against.
 */
export const drainOnce = async (
  worker: IngestionWorker,
  limit: number,
): Promise<Result<DrainSummary, AppError>> => {
  const summary: DrainSummary = { processed: 0, failed: 0, idle: false };

  for (let i = 0; i < limit; i += 1) {
    const outcome = await worker.runOnce();

    // A job that could not even be failed properly is counted and reported, not
    // thrown away: returning an error here discarded the fact that earlier
    // documents advanced, so the caller could not tell progress from a dead
    // drain, and its retry started blind.
    if (!outcome.ok) {
      summary.failed += 1;
      summary.lastError = outcome.error.detail ?? outcome.error.type;
      break;
    }

    if (outcome.value === "idle") {
      summary.idle = true;
      break;
    }

    if (outcome.value === "processed") summary.processed += 1;
    else summary.failed += 1;
  }

  return ok(summary);
};

/**
 * The same pass, wired to the real queue, storage, parsers and embeddings.
 */
export const drainIngestionQueue = async (
  limit: number,
): Promise<Result<DrainSummary, AppError>> => {
  const configuration = env();
  const db = createServiceDbClient();

  if (!db.ok) return err(db.error);

  if (!configuration.MULTIUTILITY_API_KEY) {
    return err(
      AppError.misconfigured("MULTIUTILITY_API_KEY is not set, so nothing can be embedded"),
    );
  }

  const repository = createIngestionRepository(db.value);

  const worker = createIngestionWorker({
    queue: repository,
    store: repository,
    extract: (job) => extractDocument(db.value, job),
    embeddings: createEmbeddingsClient({
      baseUrl: configuration.EMBEDDINGS_BASE_URL,
      apiKey: configuration.MULTIUTILITY_API_KEY,
      // Embedding a batch of chunks is slower than embedding one query, and the
      // Space cold-starts.
      timeoutMs: BATCH_TIMEOUT_MS,
    }),
  });

  return drainOnce(worker, limit);
};
