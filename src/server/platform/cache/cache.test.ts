import { describe, expect, it, vi } from "vitest";
import { createCache, embeddingKey } from "./cache";

describe("embeddingKey", () => {
  it("is stable for the same text", async () => {
    expect(await embeddingKey("what changed in Q3?")).toBe(
      await embeddingKey("what changed in Q3?"),
    );
  });

  it("differs for different text", async () => {
    expect(await embeddingKey("a")).not.toBe(await embeddingKey("b"));
  });

  it("is namespaced, so one flush does not take unrelated keys with it", async () => {
    expect(await embeddingKey("a")).toMatch(/^embedding:/);
  });
});

describe("createCache", () => {
  it("is a miss on every read when no Redis is configured", async () => {
    const cache = createCache({});

    expect(cache.configured).toBe(false);
    expect(await cache.get<number[]>("k")).toBeUndefined();
    // A write is a no-op rather than an error, so callers need no branch.
    await cache.set("k", [1, 2, 3], 60);
    expect(await cache.get<number[]>("k")).toBeUndefined();
  });

  it("reads through to Redis when it is configured", async () => {
    const redis = {
      get: vi.fn(async () => [0.1, 0.2]),
      set: vi.fn(async () => "OK"),
    };
    const cache = createCache({ redis });

    expect(cache.configured).toBe(true);
    expect(await cache.get<number[]>("k")).toEqual([0.1, 0.2]);
    expect(redis.get).toHaveBeenCalledWith("k");
  });

  it("writes with the TTL it was given", async () => {
    const redis = { get: vi.fn(async () => null), set: vi.fn(async () => "OK") };
    const cache = createCache({ redis });

    await cache.set("k", [0.1], 120);

    expect(redis.set).toHaveBeenCalledWith("k", [0.1], { ex: 120 });
  });

  it("treats a cache failure as a miss rather than failing the request", async () => {
    const redis = {
      get: vi.fn(async () => {
        throw new Error("redis is down");
      }),
      set: vi.fn(async () => {
        throw new Error("redis is down");
      }),
    };
    const cache = createCache({ redis });

    expect(await cache.get<number[]>("k")).toBeUndefined();
    await expect(cache.set("k", [0.1], 60)).resolves.toBeUndefined();
  });
});
