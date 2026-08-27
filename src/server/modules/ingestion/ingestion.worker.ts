import type { Chunk } from "@/core/chunking";
import type { AppError } from "@/core/errors";
import { ok, type Result } from "@/core/result";

export interface ClaimedJob {
  jobId: number;
  documentId: string;
  attempts: number;
}

interface Queue {
  claim(): Promise<Result<ClaimedJob | undefined, AppError>>;
  complete(jobId: number): Promise<Result<void, AppError>>;
  fail(jobId: number, error: string): Promise<Result<void, AppError>>;
  /** The highest chunk_index already stored for a document, or -1 for none. */
  highWaterMark(documentId: string): Promise<Result<number, AppError>>;
}

interface Store {
  setExpectedChunks(documentId: string, expected: number): Promise<Result<void, AppError>>;
  insertChunks(
    documentId: string,
    chunks: { chunk_index: number; content: string; embedding: number[]; metadata: unknown }[],
  ): Promise<Result<number, AppError>>;
}

interface Dependencies {
  queue: Queue;
  /** Fetch and chunk one document. Everything provider-shaped lives behind this. */
  extract(job: ClaimedJob): Promise<Result<{ chunks: Chunk[]; expectedChunks: number }, AppError>>;
  embeddings: { embed(texts: string[]): Promise<Result<number[][], AppError>> };
  store: Store;
  /** Chunks per embedding call. The Space takes an array. */
  batchSize?: number;
}

export interface IngestionWorker {
  runOnce(): Promise<Result<"idle" | "processed" | "failed", AppError>>;
}

/**
 * One pass over the queue: claim a job, extract, embed in batches, write each
 * batch as it lands, then complete or fail.
 *
 * Ingestion used to run inside the request that triggered it, sleeping five
 * seconds after every five chunks — roughly eight minutes idle on a 500-chunk
 * document — and a timeout or a redeploy lost the work with no record and no
 * retry. Batches are written progressively here so a second attempt resumes from
 * the high-water chunk index rather than starting over.
 */
export const createIngestionWorker = ({
  queue,
  extract,
  embeddings,
  store,
  batchSize = 32,
}: Dependencies): IngestionWorker => ({
  async runOnce() {
    const claimed = await queue.claim();
    if (!claimed.ok) return claimed;
    if (!claimed.value) return ok("idle");

    const job = claimed.value;

    const failJob = async (reason: string) => {
      await queue.fail(job.jobId, reason);
      return ok<"failed">("failed");
    };

    const extracted = await extract(job);
    if (!extracted.ok) return failJob(extracted.error.detail ?? extracted.error.type);

    const { chunks, expectedChunks } = extracted.value;

    // Written before embedding starts, so the interface can show a true fraction
    // instead of one of four words.
    const expected = await store.setExpectedChunks(job.documentId, expectedChunks);
    if (!expected.ok) return failJob(expected.error.detail ?? expected.error.type);

    const mark = await queue.highWaterMark(job.documentId);
    if (!mark.ok) return failJob(mark.error.detail ?? mark.error.type);

    const remaining = chunks.filter((chunk) => chunk.index > mark.value);

    for (let start = 0; start < remaining.length; start += batchSize) {
      const batch = remaining.slice(start, start + batchSize);

      const vectors = await embeddings.embed(batch.map((chunk) => chunk.content));
      if (!vectors.ok) return failJob(vectors.error.detail ?? vectors.error.type);

      const written = await store.insertChunks(
        job.documentId,
        batch.map((chunk, i) => ({
          chunk_index: chunk.index,
          content: chunk.content,
          embedding: vectors.value[i],
          metadata: chunk.metadata,
        })),
      );

      if (!written.ok) return failJob(written.error.detail ?? written.error.type);
    }

    const completed = await queue.complete(job.jobId);
    if (!completed.ok) return completed;

    return ok("processed");
  },
});
