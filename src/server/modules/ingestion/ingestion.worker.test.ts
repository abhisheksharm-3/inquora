import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import { createIngestionWorker } from "./ingestion.worker";

const chunks = [
  { index: 0, content: "first passage", metadata: {} },
  { index: 1, content: "second passage", metadata: {} },
  { index: 2, content: "third passage", metadata: {} },
];

const vector = (fill: number) => Array.from({ length: 1024 }, () => fill);

const deps = (overrides: Record<string, unknown> = {}) => ({
  queue: {
    claim: vi.fn(async () => ok({ jobId: 1, documentId: "doc-1", attempts: 1 })),
    complete: vi.fn(async () => ok(undefined)),
    fail: vi.fn(async () => ok(undefined)),
    highWaterMark: vi.fn(async () => ok(-1)),
  },
  extract: vi.fn(async () => ok({ chunks, expectedChunks: chunks.length })),
  embeddings: { embed: vi.fn(async (texts: string[]) => ok(texts.map((_, i) => vector(i / 10)))) },
  store: {
    setExpectedChunks: vi.fn(async () => ok(undefined)),
    insertChunks: vi.fn(async () => ok(3)),
  },
  batchSize: 2,
  ...overrides,
});

describe("ingestion worker", () => {
  it("does nothing when the queue is empty", async () => {
    const dependencies = deps({
      queue: {
        claim: vi.fn(async () => ok(undefined)),
        complete: vi.fn(),
        fail: vi.fn(),
        highWaterMark: vi.fn(async () => ok(-1)),
      },
    });

    const result = await createIngestionWorker(dependencies as never).runOnce();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("idle");
  });

  it("records the expected chunk count before embedding, so progress is a fraction", async () => {
    const dependencies = deps();
    await createIngestionWorker(dependencies as never).runOnce();

    expect(dependencies.store.setExpectedChunks).toHaveBeenCalledWith("doc-1", 3);
    const order = dependencies.store.setExpectedChunks.mock.invocationCallOrder[0];
    expect(order).toBeLessThan(dependencies.embeddings.embed.mock.invocationCallOrder[0]);
  });

  it("embeds in batches rather than one call per chunk", async () => {
    const dependencies = deps();
    await createIngestionWorker(dependencies as never).runOnce();

    // Three chunks at a batch size of two is two calls, not three, and no sleeps.
    expect(dependencies.embeddings.embed).toHaveBeenCalledTimes(2);
  });

  it("writes each batch as it is embedded, so a timeout resumes rather than restarts", async () => {
    const dependencies = deps();
    await createIngestionWorker(dependencies as never).runOnce();

    expect(dependencies.store.insertChunks).toHaveBeenCalledTimes(2);
  });

  it("resumes from the high-water mark instead of re-embedding what is stored", async () => {
    const dependencies = deps({
      queue: {
        claim: vi.fn(async () => ok({ jobId: 1, documentId: "doc-1", attempts: 2 })),
        complete: vi.fn(async () => ok(undefined)),
        fail: vi.fn(async () => ok(undefined)),
        highWaterMark: vi.fn(async () => ok(1)),
      },
    });

    await createIngestionWorker(dependencies as never).runOnce();

    const embedded = dependencies.embeddings.embed.mock.calls.flatMap((call) => call[0]);
    expect(embedded).toEqual(["third passage"]);
  });

  it("completes the job when every chunk is stored", async () => {
    const dependencies = deps();
    await createIngestionWorker(dependencies as never).runOnce();

    expect(dependencies.queue.complete).toHaveBeenCalledWith(1);
    expect(dependencies.queue.fail).not.toHaveBeenCalled();
  });

  it("fails the job with the reason when extraction fails", async () => {
    const dependencies = deps({
      extract: vi.fn(async () => err(AppError.badGateway("the file is not a PDF"))),
    });

    const result = await createIngestionWorker(dependencies as never).runOnce();

    expect(result.ok).toBe(true);
    expect(dependencies.queue.fail).toHaveBeenCalledWith(1, expect.stringContaining("not a PDF"));
    expect(dependencies.queue.complete).not.toHaveBeenCalled();
  });

  it("fails the job rather than completing it when a batch will not embed", async () => {
    const dependencies = deps({
      embeddings: { embed: vi.fn(async () => err(AppError.rateLimited(30, "throttled"))) },
    });

    await createIngestionWorker(dependencies as never).runOnce();

    expect(dependencies.queue.fail).toHaveBeenCalled();
    expect(dependencies.queue.complete).not.toHaveBeenCalled();
  });

  it("completes a job whose chunks are all already stored, rather than looping on it", async () => {
    const dependencies = deps({
      queue: {
        claim: vi.fn(async () => ok({ jobId: 1, documentId: "doc-1", attempts: 3 })),
        complete: vi.fn(async () => ok(undefined)),
        fail: vi.fn(async () => ok(undefined)),
        highWaterMark: vi.fn(async () => ok(2)),
      },
    });

    await createIngestionWorker(dependencies as never).runOnce();

    expect(dependencies.embeddings.embed).not.toHaveBeenCalled();
    expect(dependencies.queue.complete).toHaveBeenCalledWith(1);
  });
});
