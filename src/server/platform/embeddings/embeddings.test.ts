import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbeddingsClient } from "./client";

const vector = (fill: number) => Array.from({ length: 1024 }, () => fill);

const respond = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const config = {
  baseUrl: "https://space.example",
  apiKey: "test-key",
  timeoutMs: 1000,
};

describe("embeddings client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns one vector per input text", async () => {
    const fetchMock = vi.fn(async () =>
      respond({ embeddings: [vector(0.1), vector(0.2)], model: "m", dimensions: 1024 }),
    );
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one", "two"]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends the key as x-api-key, which is what the Space requires", async () => {
    const seen: RequestInit[] = [];
    const client = createEmbeddingsClient({
      ...config,
      fetch: async (_url, init) => {
        seen.push(init);
        return respond({ embeddings: [vector(0.1)], model: "m", dimensions: 1024 });
      },
    });

    await client.embed(["one"]);

    expect(new Headers(seen[0].headers).get("x-api-key")).toBe("test-key");
  });

  it("rejects a vector of the wrong dimension instead of storing it", async () => {
    const fetchMock = vi.fn(async () =>
      respond({ embeddings: [[0.1, 0.2, 0.3]], model: "m", dimensions: 3 }),
    );
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one"]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("1024");
  });

  it("returns nothing and makes no request for an empty input", async () => {
    const fetchMock = vi.fn();
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed([]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries a 429 once, honouring Retry-After", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(respond({ embeddings: [vector(0.1)], model: "m", dimensions: 1024 }));
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one"]);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not hold the request open for a long Retry-After, and passes it back", async () => {
    const fetchMock = vi.fn(
      async () => new Response("slow down", { status: 429, headers: { "retry-after": "12" } }),
    );
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one"]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(429);
      expect(result.error.retryAfterSeconds).toBe(12);
    }
    // Twelve seconds is longer than this client will wait, so it does not retry.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("surfaces a second 429 as a rate limit when the wait was short", async () => {
    const fetchMock = vi.fn(
      async () => new Response("slow down", { status: 429, headers: { "retry-after": "0" } }),
    );
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one"]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a provider failure as a bad gateway rather than throwing", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500 }));
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one"]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(502);
  });

  it("reports a refused connection as a bad gateway", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createEmbeddingsClient({ ...config, fetch: fetchMock });

    const result = await client.embed(["one"]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(502);
  });
});
