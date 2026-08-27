import { describe, expect, it, vi } from "vitest";
import { createRetrievalRepository } from "./retrieval.repository";

const row = (id: string, index: number) => ({
  chunk_id: id,
  document_id: "11111111-1111-1111-1111-111111111111",
  chunk_index: index,
  content: `chunk ${index}`,
  metadata: {},
  score: 1 / (index + 1),
  embedding: "[0.1,0.2,0.3]",
});

describe("retrieval repository", () => {
  it("calls search_chunks and nothing else", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: [row("a", 0)],
      error: null,
    }));
    const repository = createRetrievalRepository({ rpc } as never);

    await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1],
      query: "revenue",
      limit: 12,
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe("search_chunks");
  });

  it("passes the document set, query and limit through", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: [] as unknown[],
      error: null,
    }));
    const repository = createRetrievalRepository({ rpc } as never);

    await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1, 0.2],
      query: "revenue",
      limit: 7,
    });

    expect(rpc.mock.calls[0][1] as Record<string, unknown>).toMatchObject({
      p_document_ids: ["11111111-1111-1111-1111-111111111111"],
      p_query: "revenue",
    });
  });

  it("asks the database for more than the caller wants, because MMR then prunes", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: [] as unknown[],
      error: null,
    }));
    const repository = createRetrievalRepository({ rpc } as never);

    await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1],
      query: "revenue",
      limit: 10,
    });

    expect((rpc.mock.calls[0][1] as { p_limit: number }).p_limit).toBeGreaterThan(10);
  });

  it("renames the snake_case columns once, here, rather than in every caller", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: [row("a", 3)],
      error: null,
    }));
    const repository = createRetrievalRepository({ rpc } as never);

    const result = await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1],
      query: "revenue",
      limit: 12,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]).toMatchObject({ chunkId: "a", chunkIndex: 3 });
  });

  it("parses the vector Postgres sends as text", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: [row("a", 0)],
      error: null,
    }));
    const repository = createRetrievalRepository({ rpc } as never);

    const result = await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1],
      query: "revenue",
      limit: 12,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("survives a vector it cannot parse, rather than failing the query", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ ...row("a", 0), embedding: "not a vector" }],
      error: null,
    }));
    const repository = createRetrievalRepository({ rpc } as never);

    const result = await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1],
      query: "revenue",
      limit: 12,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].embedding).toEqual([]);
  });

  it("reports a database error as a bad gateway rather than throwing", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "connection reset" } }));
    const repository = createRetrievalRepository({ rpc } as never);

    const result = await repository.search({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      embedding: [0.1],
      query: "revenue",
      limit: 12,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(502);
  });
});
