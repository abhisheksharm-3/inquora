import { describe, expect, it, vi } from "vitest";
import { ok, err } from "@/core/result";
import { AppError } from "@/core/errors";
import { createTools } from "./tools";

const chunk = (id: string, index: number, content: string) => ({
  chunkId: id,
  documentId: "11111111-1111-1111-1111-111111111111",
  chunkIndex: index,
  content,
  metadata: {},
  score: 0.9,
  embedding: [0.1],
});

const context = {
  chat: { id: "22222222-2222-2222-2222-222222222222", title: null },
  documents: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      kind: "pdf",
      title: "Revenue review",
      status: "ready",
      chunkCount: 4,
    },
  ],
  messages: [],
  memories: [],
  profile: { displayName: null },
};

interface InvokableTool {
  name: string;
  invoke(input: Record<string, unknown>): Promise<unknown>;
}

const byName = (tools: unknown[], name: string) =>
  (tools as InvokableTool[]).find((t) => t.name === name)!;

describe("createTools", () => {
  it("exposes the tools the answering path needs", () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: () => {},
    });

    expect((tools as InvokableTool[]).map((t) => t.name).sort()).toEqual([
      "calculate",
      "list_documents",
      "read_chunks",
      "remember",
      "search_documents",
    ]);
  });

  it("searches only the documents attached to this chat", async () => {
    const retrieve = vi.fn(async (_request: Record<string, unknown>) =>
      ok([chunk("a", 0, "revenue fell")]),
    );
    const tools = createTools({
      context,
      retrieval: { retrieve },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: () => {},
    });

    await byName(tools, "search_documents").invoke({ query: "revenue" });

    expect(retrieve.mock.calls[0][0] as Record<string, unknown>).toMatchObject({
      documentIds: ["11111111-1111-1111-1111-111111111111"],
      query: "revenue",
    });
  });

  it("records which chunks an answer stood on, so citations can be persisted", async () => {
    const seen: string[][] = [];
    const tools = createTools({
      context,
      retrieval: {
        retrieve: async () => ok([chunk("a", 0, "revenue fell"), chunk("b", 1, "north")]),
      },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: (ids) => seen.push(ids),
    });

    await byName(tools, "search_documents").invoke({ query: "revenue" });

    expect(seen).toEqual([["a", "b"]]);
  });

  it("tells the model plainly when a search found nothing, rather than throwing", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => err(AppError.notFound("nothing matched")) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: () => {},
    });

    const answer = await byName(tools, "search_documents").invoke({ query: "revenue" });

    expect(String(answer).toLowerCase()).toContain("nothing");
  });

  it("lists what is attached, including whether it is ready to search", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: () => {},
    });

    const answer = String(await byName(tools, "list_documents").invoke({}));

    expect(answer).toContain("Revenue review");
    expect(answer).toContain("ready");
  });

  it("calculates arithmetic without reaching a language model for it", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: () => {},
    });

    expect(
      String(await byName(tools, "calculate").invoke({ expression: "(4.68 - 4.12) / 4.68 * 100" })),
    ).toContain("11.9");
  });

  it("refuses anything in calculate that is not arithmetic", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      onCitations: () => {},
    });

    const answer = String(
      await byName(tools, "calculate").invoke({ expression: "process.exit(1)" }),
    );

    expect(answer.toLowerCase()).toContain("arithmetic");
  });
});
