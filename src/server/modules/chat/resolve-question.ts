import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { needsFollowUpResolution } from "@/core/retrieval/follow-up";
import { HISTORY_TURNS } from "@/core/retrieval/retrieval.constants";
import type { ChatContext } from "./chat.schema";

/**
 * Rewrites a message that only makes sense in context into one that can be
 * searched on its own.
 *
 * "What about the second one?" embedded as written retrieves on grammar rather
 * than on subject, because the vector describes the shape of the question and not
 * what it is about.
 *
 * The heuristic gate is the point: a self-contained question skips this entirely,
 * so the common case pays nothing. The old pipeline spent a model call deciding
 * things of exactly this size on every single message.
 */

const resolved = z.object({
  question: z
    .string()
    .describe(
      "The question, rewritten so it stands alone. Keep the user's own words where possible.",
    ),
});

export const resolveQuestion = async (
  message: string,
  context: ChatContext,
  model: BaseChatModel,
): Promise<{ question: string; resolved: boolean }> => {
  if (!needsFollowUpResolution(message, context.messages.length)) {
    return { question: message, resolved: false };
  }

  const history = context.messages
    .slice(-HISTORY_TURNS)
    .map((turn) => {
      const text = turn.parts
        .filter((part) => part.kind === "text" && part.text)
        .map((part) => part.text)
        .join(" ");

      return `${turn.role}: ${text}`;
    })
    .filter((line) => line.length > 6)
    .join("\n");

  if (history.length === 0) return { question: message, resolved: false };

  try {
    const structured = model.withStructuredOutput(resolved);

    const answer = (await structured.invoke([
      {
        role: "system",
        content:
          "Rewrite the user's latest message as a question that stands on its own, using the " +
          "conversation to fill in whatever it refers to. Do not answer it. Do not add anything " +
          "the conversation does not contain.",
      },
      { role: "user", content: `Conversation so far:\n${history}\n\nLatest message: ${message}` },
    ])) as z.infer<typeof resolved>;

    const question = answer.question?.trim();

    // A rewrite that came back empty, or longer than the model was asked for, is
    // worse than the original. The original is never lost.
    if (!question || question.length > 500) return { question: message, resolved: false };

    return { question, resolved: true };
  } catch {
    // A failed rewrite must not fail the answer. Searching the raw message is a
    // worse search, not a broken one.
    return { question: message, resolved: false };
  }
};
