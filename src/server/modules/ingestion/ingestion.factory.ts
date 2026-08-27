import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import { createServiceDbClient } from "@/server/platform/db/service";
import { createEmbeddingsClient } from "@/server/platform/embeddings/client";
import { env } from "@/server/platform/env";
import { createIngestionRepository } from "./ingestion.repository";
import { createIngestionWorker } from "./ingestion.worker";
import { extractDocument } from "./extract.source";

export interface DrainSummary {
  processed: number;
  failed: number;
  idle: boolean;
}

/**
 * Drains up to `limit` jobs, then returns a summary. The worker itself is pure
 * orchestration over injected pieces; this is where the real ones are chosen.
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
      timeoutMs: 120_000,
    }),
  });

  const summary: DrainSummary = { processed: 0, failed: 0, idle: false };

  for (let i = 0; i < limit; i += 1) {
    const outcome = await worker.runOnce();

    if (!outcome.ok) return err(outcome.error);

    if (outcome.value === "idle") {
      summary.idle = true;
      break;
    }

    if (outcome.value === "processed") summary.processed += 1;
    else summary.failed += 1;
  }

  return ok(summary);
};
