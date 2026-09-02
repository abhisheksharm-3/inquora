import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import { drainOnce } from "./ingestion.factory";

/**
 * The drain's accounting, which nothing covered. A queue worker's normal case is
 * partial success, so what it reports about a partial run is the contract.
 */
describe("drainOnce", () => {
  const worker = (outcomes: ("idle" | "processed" | "failed")[], failAt?: number) => {
    let call = 0;

    return {
      runOnce: vi.fn(async () => {
        const index = call++;
        if (failAt === index)
          return err(AppError.badGateway("the queue refused to record a failure"));
        return ok(outcomes[index] ?? "idle");
      }),
    };
  };

  it("counts what it processed", async () => {
    const result = await drainOnce(worker(["processed", "processed", "idle"]), 5);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ processed: 2, failed: 0, idle: true });
  });

  it("stops when the queue is empty rather than spending the whole budget", async () => {
    const w = worker(["idle"]);
    await drainOnce(w, 5);

    expect(w.runOnce).toHaveBeenCalledOnce();
  });

  it("keeps the count of what advanced when a later job breaks", async () => {
    // Returning an error here used to discard the fact that two documents were
    // indexed, so the caller could not tell progress from a dead drain.
    const result = await drainOnce(worker(["processed", "processed"], 2), 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.processed).toBe(2);
      expect(result.value.failed).toBe(1);
      expect(result.value.lastError).toContain("refused to record");
    }
  });

  it("counts a document that failed to ingest without stopping the drain", async () => {
    const result = await drainOnce(worker(["failed", "processed", "idle"]), 5);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ processed: 1, failed: 1 });
  });

  it("never claims more jobs than the budget allows", async () => {
    const w = worker(["processed", "processed", "processed", "processed"]);
    await drainOnce(w, 2);

    expect(w.runOnce).toHaveBeenCalledTimes(2);
  });
});
