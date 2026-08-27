import { describe, expect, it, vi } from "vitest";
import { createChatRepository } from "./chat.repository";

const context = {
  chat: { id: "11111111-1111-1111-1111-111111111111", title: "Fixture" },
  documents: [],
  messages: [],
  memories: [],
  profile: { displayName: null },
};

describe("chat repository", () => {
  it("reads the whole conversation in one call", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: context,
      error: null,
    }));
    const repository = createChatRepository({ rpc } as never);

    const result = await repository.context("11111111-1111-1111-1111-111111111111");

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe("get_chat_context");
  });

  it("reports a chat that does not exist as not found, not as an empty context", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const repository = createChatRepository({ rpc } as never);

    const result = await repository.context("11111111-1111-1111-1111-111111111111");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(404);
  });

  it("rejects a context whose shape does not match the schema", async () => {
    const rpc = vi.fn(async () => ({ data: { chat: { id: "not-a-uuid" } }, error: null }));
    const repository = createChatRepository({ rpc } as never);

    const result = await repository.context("11111111-1111-1111-1111-111111111111");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(502);
  });

  it("writes the message and its citations in one call", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: "22222222-2222-2222-2222-222222222222",
      error: null,
    }));
    const repository = createChatRepository({ rpc } as never);

    const result = await repository.append({
      chatId: "11111111-1111-1111-1111-111111111111",
      role: "assistant",
      content: "the answer",
      citationChunkIds: ["33333333-3333-3333-3333-333333333333"],
      model: "gemini",
    });

    expect(result.ok).toBe(true);
    expect(rpc.mock.calls[0][0]).toBe("append_message");
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_citation_chunk_ids: ["33333333-3333-3333-3333-333333333333"],
      p_model: "gemini",
    });
  });

  it("reports a failed write as a bad gateway", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "deadlock" } }));
    const repository = createChatRepository({ rpc } as never);

    const result = await repository.append({
      chatId: "11111111-1111-1111-1111-111111111111",
      role: "assistant",
      content: "the answer",
      citationChunkIds: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(502);
  });
});
