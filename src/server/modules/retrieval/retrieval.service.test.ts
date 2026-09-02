import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import { createCache } from "@/server/platform/cache/cache";
import { createRetrievalService } from "./retrieval.service";

const vector = (fill: number) => Array.from({ length: 1024 }, () => fill);

const chunk = (id: string, index: number, score: number) => ({
  chunkId: id,
  documentId: "11111111-1111-1111-1111-111111111111",
  chunkIndex: index,
  content: `chunk ${index}`,
  metadata: {},
  score,
  embedding: vector(index / 10),
});

const request = {
  query: "why is revenue under forecast",
  documentIds: ["11111111-1111-1111-1111-111111111111"],
  limit: 2,
};

describe("retrieval service", () => {
  it("embeds the query once and searches once", async () => {
    const embed = vi.fn(async () => ok([vector(0.5)]));
    const search = vi.fn(async () => ok([chunk("a", 0, 0.9), chunk("b", 1, 0.5)]));

    const result = await createRetrievalService({
      embeddings: { embed },
      repository: { search },
      cache: createCache({}),
    }).retrieve(request);

    expect(result.ok).toBe(true);
    expect(embed).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledOnce();
  });

  it("returns not found when the document set holds nothing relevant", async () => {
    const result = await createRetrievalService({
      embeddings: { embed: async () => ok([vector(0.5)]) },
      repository: { search: async () => ok([]) },
      cache: createCache({}),
    }).retrieve(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(404);
  });

  it("passes an embedding failure through rather than searching with a bad vector", async () => {
    const search = vi.fn();

    const result = await createRetrievalService({
      embeddings: { embed: async () => err(AppError.badGateway("provider down")) },
      repository: { search },
      cache: createCache({}),
    }).retrieve(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(502);
    expect(search).not.toHaveBeenCalled();
  });

  it("never returns more chunks than the caller asked for", async () => {
    const result = await createRetrievalService({
      embeddings: { embed: async () => ok([vector(0.5)]) },
      repository: {
        search: async () => ok([chunk("a", 0, 0.9), chunk("b", 1, 0.8), chunk("c", 2, 0.7)]),
      },
      cache: createCache({}),
    }).retrieve(request);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it("reuses a cached query embedding instead of paying for it again", async () => {
    const store = new Map<string, unknown>();
    const redis = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown) => {
        store.set(key, value);
        return "OK";
      },
    };
    const embed = vi.fn(async () => ok([vector(0.5)]));
    const service = createRetrievalService({
      embeddings: { embed },
      repository: { search: async () => ok([chunk("a", 0, 0.9)]) },
      cache: createCache({ redis }),
    });

    await service.retrieve(request);
    await service.retrieve(request);

    expect(embed).toHaveBeenCalledOnce();
  });

  it("drops a near-duplicate passage in favour of one that adds something", async () => {
    const duplicate = { ...chunk("duplicate", 0, 0.88), embedding: vector(0.5) };
    const original = { ...chunk("original", 1, 0.9), embedding: vector(0.5) };
    const different = { ...chunk("different", 2, 0.4), embedding: vector(-0.5) };

    const result = await createRetrievalService({
      embeddings: { embed: async () => ok([vector(0.5)]) },
      repository: { search: async () => ok([original, duplicate, different]) },
      cache: createCache({}),
    }).retrieve({ ...request, limit: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((c) => c.chunkId)).toEqual(["original", "different"]);
  });

  it("keeps the chunk the model needs first, ranked", async () => {
    const result = await createRetrievalService({
      embeddings: { embed: async () => ok([vector(0.5)]) },
      repository: {
        search: async () => ok([chunk("low", 0, 0.2), chunk("high", 1, 0.95)]),
      },
      cache: createCache({}),
    }).retrieve({ ...request, limit: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].chunkId).toBe("high");
  });
});
