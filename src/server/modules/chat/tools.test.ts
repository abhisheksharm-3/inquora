import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
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
  chat: { id: "22222222-2222-2222-2222-222222222222", title: null, webSearch: false },
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
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    expect((tools as InvokableTool[]).map((t) => t.name).sort()).toEqual([
      "calculate",
      "get_outline",
      "get_transcript",
      "grep_document",
      "list_documents",
      "list_tables",
      "query_table",
      "read_chunks",
      "read_file",
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
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
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
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: (chunks) => (seen.push(chunks.map((chunk) => chunk.chunkId)), []),
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
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
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
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(await byName(tools, "list_documents").invoke({}));

    expect(answer).toContain("Revenue review");
    expect(answer).toContain("ready");
  });

  it("queries a spreadsheet rather than searching it", async () => {
    const query = vi.fn(async (_q: Record<string, unknown>) => ok([{ total: 101000 }]));
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "query_table").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        table_name: "Pipeline",
        sql: 'select sum("Value"::numeric) as total from t',
      }),
    );

    expect(answer).toContain("101000");
    expect(query.mock.calls[0][0]).toMatchObject({ tableName: "Pipeline" });
  });

  it("hands a refused query back verbatim, so the model can correct it", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: {
        list: async () => ok([]),
        query: async () => err(AppError.badRequest("the query may not use delete")),
      },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "query_table").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        table_name: "Pipeline",
        sql: "delete from t",
      }),
    );

    expect(answer).toContain("may not use delete");
  });

  it("refuses to query a document that is not in this conversation", async () => {
    const query = vi.fn(async (_q: Record<string, unknown>) => ok([]));
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "query_table").invoke({
        document_id: "99999999-9999-4999-8999-999999999999",
        table_name: "Pipeline",
        sql: "select * from t",
      }),
    );

    expect(answer).toContain("not attached");
    expect(query).not.toHaveBeenCalled();
  });

  it("shows the real column names before a query is written", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: {
        list: async () => ok([{ name: "Pipeline", header: ["Account", "Value"], rowCount: 3 }]),
        query: async () => ok([]),
      },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "list_tables").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
      }),
    );

    expect(answer).toContain("Pipeline");
    expect(answer).toContain("Account, Value");
  });

  it("reports which file a repository match came from, not only the line", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: {
        outline: async () => ok(null),
        grep: async () =>
          ok([{ path: "src/queue.ts", lineNumber: 42, line: "  claim_ingestion_job()" }]),
      },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "grep_document").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        pattern: "claim_ingestion_job",
      }),
    );

    // A line number alone does not say which of two thousand files it is in.
    expect(answer).toBe("src/queue.ts:42:   claim_ingestion_job()");
  });

  it("finds an exact identifier that a meaning-based search flattens", async () => {
    const grep = vi.fn(async (_q: Record<string, unknown>) =>
      ok([{ path: null, lineNumber: 2, line: "The cause was error PG-4711 in a trigger." }]),
    );
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "grep_document").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        pattern: "PG-4711",
      }),
    );

    // The line number matters: a citation points at a line, not at a document.
    expect(answer).toBe("2: The cause was error PG-4711 in a trigger.");
  });

  it("says plainly when a document has no outline yet", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "get_outline").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
      }),
    );

    expect(answer).toContain("no outline");
  });

  it("returns the outline a document does have", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: {
        outline: async () => ok({ headings: [{ level: 1, title: "Revenue", at: 0 }] }),
        grep: async () => ok([]),
      },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "get_outline").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
      }),
    );

    expect(answer).toContain("Revenue");
  });

  it("reads a file from a repository with its line range", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: {
        file: async () =>
          ok([
            {
              path: "src/a.ts",
              content: "export function first() {}",
              fromLine: 1,
              toLine: 30,
              lineCount: 120,
            },
          ]),
        transcript: async () => ok([]),
      },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "read_file").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        path: "src/a.ts",
      }),
    );

    // The line range and the file length together tell the model whether it has
    // seen the whole file or a window into it.
    expect(answer).toContain("src/a.ts:1-30 of 120 lines");
    expect(answer).toContain("export function first");
  });

  it("points at the file tree when a path does not exist", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "read_file").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        path: "src/missing.ts",
      }),
    );

    expect(answer).toContain("get_outline");
  });

  it("returns a transcript segment with the timestamps a deep link needs", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: {
        file: async () => ok([]),
        transcript: async () =>
          ok([{ content: "Revenue came in under forecast.", startSeconds: 30, endSeconds: 75 }]),
      },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "get_transcript").invoke({
        document_id: "11111111-1111-1111-1111-111111111111",
        start_s: 0,
        end_s: 120,
      }),
    );

    expect(answer).toBe("[30s-75s] Revenue came in under forecast.");
  });

  it("does not offer web search when the deployment has no provider", () => {
    const tools = createTools({
      context: { ...context, chat: { ...context.chat, webSearch: true } },
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    expect((tools as InvokableTool[]).map((t) => t.name)).not.toContain("web_search");
  });

  it("does not offer web search when the conversation has not asked for it", () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: true, search: async () => ok([]) },
      onCitations: () => [],
    });

    // Both gates are required, and neither implies the other.
    expect((tools as InvokableTool[]).map((t) => t.name)).not.toContain("web_search");
  });

  it("marks a web result as web, so it is not mistaken for the user's own document", async () => {
    const tools = createTools({
      context: { ...context, chat: { ...context.chat, webSearch: true } },
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: {
        configured: true,
        search: async () =>
          ok([
            {
              title: "Postgres statement timeout",
              url: "https://example.com/timeout",
              extract: "statement_timeout aborts a statement that runs longer than the value.",
            },
          ]),
      },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "web_search").invoke({ query: "postgres statement timeout" }),
    );

    expect(answer).toContain("[web]");
    expect(answer).toContain("https://example.com/timeout");
  });

  it("calculates arithmetic without reaching a language model for it", async () => {
    const tools = createTools({
      context,
      retrieval: { retrieve: async () => ok([]) },
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
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
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
      web: { configured: false, search: async () => ok([]) },
      onCitations: () => [],
    });

    const answer = String(
      await byName(tools, "calculate").invoke({ expression: "process.exit(1)" }),
    );

    expect(answer.toLowerCase()).toContain("arithmetic");
  });
});
