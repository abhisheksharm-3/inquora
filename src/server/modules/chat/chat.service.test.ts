import { describe, expect, it, vi } from "vitest";
import { FakeToolCallingModel } from "langchain";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import { createChatService } from "./chat.service";

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

const chunk = {
  chunkId: "33333333-3333-3333-3333-333333333333",
  documentId: "11111111-1111-1111-1111-111111111111",
  chunkIndex: 0,
  content: "Q3 revenue closed at 4.12 million.",
  metadata: {},
  score: 0.9,
  embedding: [0.1],
};

const drain = async (stream: ReadableStream<Uint8Array>) => {
  const decoder = new TextDecoder();
  let body = "";
  for await (const part of stream as unknown as AsyncIterable<Uint8Array>)
    body += decoder.decode(part);
  return body;
};

interface AppendCall {
  role: string;
  citationChunkIds: string[];
  latencyMs?: number;
  retrievalMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
}

const deps = (overrides: Record<string, unknown> = {}) => ({
  repository: {
    context: async () => ok(context),
    append: vi.fn(async (_args: AppendCall) => ok("44444444-4444-4444-4444-444444444444")),
  },
  retrieval: { retrieve: async () => ok([chunk]) },
  chunks: { range: async () => ok([]) },
  memories: { remember: async () => ok("id") },
  tables: { list: async () => ok([]), query: async () => ok([]) },
  structure: { outline: async () => ok(null), grep: async () => ok([]) },
  slices: { file: async () => ok([]), transcript: async () => ok([]) },
  model: async () => ok(new FakeToolCallingModel({ toolCalls: [[]] })),
  ...overrides,
});

describe("chat service", () => {
  it("persists the user message before generating, so a crash does not lose the question", async () => {
    const dependencies = deps();
    const result = await createChatService(dependencies as never).send({
      chatId: "22222222-2222-2222-2222-222222222222",
      content: "why did revenue miss?",
      parentId: null,
    });

    expect(result.ok).toBe(true);
    const roles = dependencies.repository.append.mock.calls.map((call) => call[0].role);
    expect(roles[0]).toBe("user");
  });

  it("writes the assistant message once, at the end of the stream", async () => {
    const dependencies = deps();
    const result = await createChatService(dependencies as never).send({
      chatId: "22222222-2222-2222-2222-222222222222",
      content: "why did revenue miss?",
      parentId: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) await drain(result.value);

    const roles = dependencies.repository.append.mock.calls.map((call) => call[0].role);
    expect(roles).toEqual(["user", "assistant"]);
  });

  it("attaches the cited chunks to the assistant message", async () => {
    const dependencies = deps();
    const model = async () =>
      ok(
        new FakeToolCallingModel({
          toolCalls: [[{ name: "search_documents", args: { query: "revenue" }, id: "c1" }], []],
        }),
      );
    const service = createChatService({ ...dependencies, model } as never);

    const result = await service.send({
      chatId: "22222222-2222-2222-2222-222222222222",
      content: "why did revenue miss?",
      parentId: null,
    });

    if (result.ok) await drain(result.value);

    const assistant = dependencies.repository.append.mock.calls
      .map((call) => call[0])
      .find((args) => args.role === "assistant");

    expect(assistant?.citationChunkIds).toEqual(["33333333-3333-3333-3333-333333333333"]);
  });

  it("records what the turn cost, so cost per conversation stays a SQL question", async () => {
    const dependencies = deps();
    const result = await createChatService(dependencies as never).send({
      chatId: "22222222-2222-2222-2222-222222222222",
      content: "why did revenue miss?",
      parentId: null,
    });

    if (result.ok) await drain(result.value);

    const assistant = dependencies.repository.append.mock.calls
      .map((call) => call[0])
      .find((args) => args.role === "assistant");

    expect(assistant?.latencyMs).toBeGreaterThan(0);
    expect(assistant?.retrievalMs).toBeGreaterThanOrEqual(0);
  });

  it("fails before streaming when the chat does not exist", async () => {
    const result = await createChatService(
      deps({
        repository: {
          context: async () => err(AppError.notFound("no such chat")),
          append: vi.fn(async (_args: AppendCall) => ok("id")),
        },
      }) as never,
    ).send({ chatId: "22222222-2222-2222-2222-222222222222", content: "hello", parentId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(404);
  });

  it("refuses to answer while every attached document is still processing", async () => {
    const processing = {
      ...context,
      documents: [{ ...context.documents[0], status: "processing", chunkCount: 0 }],
    };

    const result = await createChatService(
      deps({
        repository: {
          context: async () => ok(processing),
          append: vi.fn(async (_args: AppendCall) => ok("id")),
        },
      }) as never,
    ).send({ chatId: "22222222-2222-2222-2222-222222222222", content: "hello", parentId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(409);
  });

  it("reports a missing model key as a configuration error rather than a bad answer", async () => {
    const result = await createChatService(
      deps({
        model: async () => err(AppError.misconfigured("GEMINI_API_KEY is not set")),
      }) as never,
    ).send({ chatId: "22222222-2222-2222-2222-222222222222", content: "hello", parentId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(500);
  });
});
