import { describe, expect, it, vi } from "vitest";
import { FakeToolCallingModel } from "langchain";
import { FakeStreamingChatModel } from "@langchain/core/utils/testing";
import { AIMessage } from "@langchain/core/messages";
import { ok } from "@/core/result";
import { createAnsweringAgent } from "./agent";

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
  memories: ["prefers short answers"],
  profile: { displayName: "Abhishek" },
};

const chunk = {
  chunkId: "33333333-3333-3333-3333-333333333333",
  documentId: "11111111-1111-1111-1111-111111111111",
  chunkIndex: 0,
  content: "Q3 revenue closed at 4.12 million against a forecast of 4.68 million.",
  metadata: {},
  score: 0.9,
  embedding: [0.1],
};

const dependencies = (overrides: Record<string, unknown> = {}) => ({
  context,
  retrieval: { retrieve: async () => ok([chunk]) },
  chunks: { range: async () => ok([]) },
  memories: { remember: async () => ok("id") },
  tables: { list: async () => ok([]), query: async () => ok([]) },
  structure: { outline: async () => ok(null), grep: async () => ok([]) },
  slices: { file: async () => ok([]), transcript: async () => ok([]) },
  web: { configured: false, search: async () => ok([]) },
  ...overrides,
});

describe("createAnsweringAgent", () => {
  it("streams the answer and reports which chunks it cited", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [[{ name: "search_documents", args: { query: "revenue" }, id: "call_1" }], []],
    });

    const agent = createAnsweringAgent({ ...dependencies(), model });
    const events: string[] = [];

    for await (const event of agent.stream("why did revenue miss?")) events.push(event.event);

    expect(events).toContain("messages/partial");
    expect(agent.citedChunkIds()).toEqual(["33333333-3333-3333-3333-333333333333"]);
  });

  it("dispatches the first search before the model asks, so the answer does not wait for it", async () => {
    const retrieve = vi.fn(async () => ok([chunk]));
    const model = new FakeToolCallingModel({ toolCalls: [[]] });

    const agent = createAnsweringAgent({ ...dependencies({ retrieval: { retrieve } }), model });

    // Speculative: dispatched at construction, in parallel with the first model
    // call, not after it.
    agent.warm("why did revenue miss?");
    for await (const _ of agent.stream("why did revenue miss?")) {
      // drain
    }

    expect(retrieve).toHaveBeenCalled();
  });

  it("does not search when no documents are attached", async () => {
    const retrieve = vi.fn(async () => ok([chunk]));
    const model = new FakeToolCallingModel({ toolCalls: [[]] });

    const agent = createAnsweringAgent({
      ...dependencies({ retrieval: { retrieve }, context: { ...context, documents: [] } }),
      model,
    });

    agent.warm("what did we discuss?");

    expect(retrieve).not.toHaveBeenCalled();
  });

  it("tells the model how to work with the kind of document that is attached", () => {
    const model = new FakeToolCallingModel({ toolCalls: [[]] });
    const agent = createAnsweringAgent({ ...dependencies(), model });

    // A pdf is attached, so the prompt carries the prose guidance and not the
    // repository or spreadsheet guidance.
    expect(agent.systemPrompt()).toContain("read_chunks");
    expect(agent.systemPrompt()).not.toContain("::numeric");
  });

  it("specializes on a repository when one is attached", () => {
    const model = new FakeToolCallingModel({ toolCalls: [[]] });
    const agent = createAnsweringAgent({
      ...dependencies({
        context: {
          ...context,
          documents: [{ ...context.documents[0], kind: "github", title: "inquora" }],
        },
      }),
      model,
    });

    const prompt = agent.systemPrompt();

    expect(prompt).toContain("file tree");
    expect(prompt).toContain("path:line");
    // And it states its limit rather than letting the model discover it. Asserted
    // on the presence of a caveat, not its wording, because the number moved once
    // already and pinned the test to a stale prompt.
    expect(prompt).toContain("Limits:");
  });

  it("says plainly that there is nothing to search when nothing is attached", () => {
    const model = new FakeToolCallingModel({ toolCalls: [[]] });
    const agent = createAnsweringAgent({
      ...dependencies({ context: { ...context, documents: [] } }),
      model,
    });

    expect(agent.systemPrompt()).toContain("nothing to search");
  });

  it("puts what the user asked to be remembered into the system prompt", () => {
    const model = new FakeToolCallingModel({ toolCalls: [[]] });
    const agent = createAnsweringAgent({ ...dependencies(), model });

    expect(agent.systemPrompt()).toContain("prefers short answers");
    expect(agent.systemPrompt()).toContain("Revenue review");
  });

  it("counts the time spent in retrieval separately from the time spent thinking", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [[{ name: "search_documents", args: { query: "revenue" }, id: "call_1" }], []],
    });
    const slowRetrieval = {
      retrieve: async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return ok([chunk]);
      },
    };

    const agent = createAnsweringAgent({
      ...dependencies({ retrieval: slowRetrieval }),
      model,
    });

    for await (const _ of agent.stream("why did revenue miss?")) {
      // drain
    }

    expect(agent.usage().retrievalMs).toBeGreaterThanOrEqual(20);
  });

  it("reports no token counts when the model reports none, rather than inventing zeroes", async () => {
    const model = new FakeToolCallingModel({ toolCalls: [[]] });
    const agent = createAnsweringAgent({ ...dependencies(), model });

    for await (const _ of agent.stream("why did revenue miss?")) {
      // drain
    }

    const usage = agent.usage();
    expect(usage.tokensIn).toBeUndefined();
    expect(usage.tokensOut).toBeUndefined();
  });

  it("keeps the whole answer, not the last delta", async () => {
    // streamMode "messages" yields deltas. Assigning rather than appending
    // persisted the final chunk alone: a 44-chunk answer stored as ".".
    const sentence = "Revenue missed the forecast by 0.56 million.";
    const model = new FakeStreamingChatModel({ responses: [new AIMessage(sentence)] });

    const agent = createAnsweringAgent({ ...dependencies(), model: model as never });

    for await (const _ of agent.stream("why did revenue miss?")) {
      // drain
    }

    expect(agent.answerText()).toBe(sentence);
  });

  it("collects the answer text as it streams, so it can be persisted at the end", async () => {
    const model = new FakeToolCallingModel({ toolCalls: [[]] });
    const agent = createAnsweringAgent({ ...dependencies(), model });

    for await (const _ of agent.stream("why did revenue miss?")) {
      // drain
    }

    expect(agent.answerText().length).toBeGreaterThan(0);
  });
});

describe("the speculative first search", () => {
  const chunk = {
    chunkId: "33333333-3333-3333-3333-333333333333",
    documentId: "11111111-1111-1111-1111-111111111111",
    chunkIndex: 0,
    content: "Q3 revenue closed at 4.12 million.",
    metadata: {},
    score: 0.9,
    embedding: [0.1],
  };

  it("is reused when the model rewords the question rather than repeating it", async () => {
    const retrieve = vi.fn(async () => ok([chunk]));
    const model = new FakeToolCallingModel({
      toolCalls: [
        // What a model actually sends: the question with the grammar stripped.
        // String equality threw this away and paid for the same search twice.
        [{ name: "search_documents", args: { query: "Q3 revenue forecast miss" }, id: "c1" }],
        [],
      ],
    });

    const agent = createAnsweringAgent({
      ...dependencies({ retrieval: { retrieve } }),
      model,
    });

    agent.warm("why did Q3 revenue miss the forecast?");

    for await (const _ of agent.stream("why did Q3 revenue miss the forecast?")) {
      // drain
    }

    // One retrieval, not two: string equality would have thrown the first away.
    expect(retrieve).toHaveBeenCalledOnce();
    expect(agent.usage().warmHits).toBe(1);
    expect(agent.usage().warmMisses).toBe(0);
  });

  it("is thrown away when the model searches for something else, and says so", async () => {
    // A different subject must not be served the warmed passages: answering from
    // the wrong chunks is worse than paying for a second search.
    const retrieve = vi.fn(async () => ok([chunk]));
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            name: "search_documents",
            args: { query: "engineering onboarding checklist" },
            id: "c1",
          },
        ],
        [],
      ],
    });

    const agent = createAnsweringAgent({
      ...dependencies({ retrieval: { retrieve } }),
      model,
    });

    agent.warm("why did Q3 revenue miss the forecast?");

    for await (const _ of agent.stream("why did Q3 revenue miss the forecast?")) {
      // drain
    }

    expect(agent.usage().warmHits).toBe(0);
    expect(agent.usage().warmMisses).toBe(1);
  });
});
