import { describe, expect, it, vi } from "vitest";
import { resolveQuestion } from "./resolve-question";

const context = (turns: string[]) => ({
  chat: { id: "22222222-2222-2222-2222-222222222222", title: null },
  documents: [],
  messages: turns.map((text, index) => ({
    id: `1111111${index}-1111-1111-1111-111111111111`,
    role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    parentId: null,
    parts: [{ kind: "text", text }],
  })),
  memories: [],
  profile: { displayName: null },
});

const modelReturning = (question: string) => {
  const invoke = vi.fn(async () => ({ question }));
  return {
    model: { withStructuredOutput: () => ({ invoke }) } as never,
    invoke,
  };
};

describe("resolveQuestion", () => {
  it("rewrites a message that only makes sense in context", async () => {
    const { model, invoke } = modelReturning("Which region explains the Q3 shortfall?");

    const result = await resolveQuestion(
      "what about the second one?",
      context(["why did Q3 revenue miss?", "The shortfall is in two regions."]),
      model,
    );

    expect(result.resolved).toBe(true);
    expect(result.question).toBe("Which region explains the Q3 shortfall?");
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("spends nothing on a question that already stands alone", async () => {
    const { model, invoke } = modelReturning("should not be called");

    const result = await resolveQuestion(
      "why is Q3 revenue twelve percent under forecast when pipeline coverage was above target",
      context(["earlier question", "earlier answer"]),
      model,
    );

    expect(result.resolved).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("spends nothing on the first message of a conversation", async () => {
    const { model, invoke } = modelReturning("should not be called");

    const result = await resolveQuestion("and Q4?", context([]), model);

    expect(result.resolved).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps the original when the rewrite comes back empty", async () => {
    const { model } = modelReturning("   ");

    const result = await resolveQuestion(
      "what about the second one?",
      context(["why did Q3 revenue miss?", "Two regions."]),
      model,
    );

    expect(result.question).toBe("what about the second one?");
    expect(result.resolved).toBe(false);
  });

  it("keeps the original when the model fails, rather than failing the answer", async () => {
    const model = {
      withStructuredOutput: () => ({
        invoke: async () => {
          throw new Error("provider is down");
        },
      }),
    } as never;

    const result = await resolveQuestion(
      "what about the second one?",
      context(["why did Q3 revenue miss?", "Two regions."]),
      model,
    );

    expect(result.question).toBe("what about the second one?");
    expect(result.resolved).toBe(false);
  });
});
