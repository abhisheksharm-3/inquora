import { err, ok } from "@/core/result";
import { EMBEDDING_BATCH } from "@/server/platform/embeddings/embeddings.constants";
import type { IngestionWorker, WorkerDependencies } from "./ingestion.types";

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
  batchSize = EMBEDDING_BATCH,
}: WorkerDependencies): IngestionWorker => ({
  async runOnce() {
    const claimed = await queue.claim();
    if (!claimed.ok) return claimed;
    if (!claimed.value) return ok("idle");

    const job = claimed.value;

    const failJob = async (reason: string) => {
      const recorded = await queue.fail(job.jobId, reason);

      // The queue refuses to fail a job that is gone, which is how a partially
      // ingested document used to go quiet. If the reason could not be recorded,
      // that is the error worth returning rather than a tidy "failed".
      if (!recorded.ok) return err(recorded.error);

      return ok<"failed">("failed");
    };

    const extracted = await extract(job);
    if (!extracted.ok) return failJob(extracted.error.detail ?? extracted.error.type);

    const { chunks, expectedChunks, tables, files, outline, text } = extracted.value;

    // Written before embedding starts, so the interface can show a true fraction
    // instead of one of four words.
    const expected = await store.setExpectedChunks(job.documentId, expectedChunks);
    if (!expected.ok) return failJob(expected.error.detail ?? expected.error.type);

    // The outline and the retained text are written before embedding, because
    // they cost nothing and a document that fails halfway is still greppable and
    // still has a structure a reader can see.
    if (outline) {
      const described = await store.setOutline(job.documentId, outline, text);
      if (!described.ok) return failJob(described.error.detail ?? described.error.type);
    }

    // Files before embeddings: once they are stored, grep and read_file already
    // answer every exact question about a repository, so a run that fails halfway
    // has still delivered most of the value.
    if (files && files.length > 0) {
      const stored = await store.insertFiles(job.documentId, files);
      if (!stored.ok) return failJob(stored.error.detail ?? stored.error.type);
    }

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

    // Sheets land as rows as well as chunks, so the numbers in a spreadsheet can
    // be queried exactly rather than read out of a sentence. Written after the
    // chunks, because a failure here should not cost the embeddings.
    for (const table of tables ?? []) {
      const written = await store.insertTable(job.documentId, table);
      if (!written.ok) return failJob(written.error.detail ?? written.error.type);
    }

    const completed = await queue.complete(job.jobId);
    if (!completed.ok) return completed;

    return ok("processed");
  },
});
