import { describe, expect, it } from "vitest";
import { startSpan, withSpan } from "./span";

/**
 * With no exporter configured the tracer is the SDK's no-op. These assert the
 * shape holds anyway, because every call site depends on that: instrumentation
 * that throws when unconfigured is worse than none.
 */
describe("startSpan", () => {
  it("returns a usable handle when nothing is configured", () => {
    const span = startSpan("retrieval", { documents: 3 });

    expect(() => span.set({ chunks: 12 })).not.toThrow();
    expect(() => span.fail(new Error("boom"))).not.toThrow();
    expect(() => span.end()).not.toThrow();
  });

  it("accepts undefined attributes rather than rejecting them", () => {
    expect(() => startSpan("generation", { model: undefined, tokens: 4 }).end()).not.toThrow();
  });
});

describe("withSpan", () => {
  it("returns the work's value", async () => {
    expect(await withSpan("embedding", { texts: 1 }, async () => 42)).toBe(42);
  });

  it("lets the error through, so a span never swallows a failure", async () => {
    await expect(
      withSpan("tool", { name: "search_documents" }, async () => {
        throw new Error("the provider is down");
      }),
    ).rejects.toThrow("the provider is down");
  });

  it("gives the work its span, so attributes discovered during it are recorded", async () => {
    const seen = await withSpan("generation", {}, async (span) => {
      span.set({ tokens_out: 128 });
      return "done";
    });

    expect(seen).toBe("done");
  });
});
