import { createAgent, toolCallLimitMiddleware } from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";
import type { RetrievalRequest, RetrievedChunk } from "@/server/modules/retrieval/retrieval.schema";
import type { StreamEvent } from "@/server/platform/http/sse";
import type { ChatContext } from "./chat.schema";
import { createTools } from "./tools";

/**
 * The cap on tool calls in one run. A model can call the same tool forever
 * without converging, and the bill is the only place that would show up
 * otherwise. The limit comes from LangChain's own middleware rather than a
 * hand-written counter around the loop: runLimit is per message, which is the
 * boundary that matters, rather than per thread.
 */
const MAX_TOOL_CALLS = 8;

interface Dependencies {
  context: ChatContext;
  model: BaseChatModel;
  retrieval: { retrieve(request: RetrievalRequest): Promise<Result<RetrievedChunk[], AppError>> };
  chunks: {
    range(args: {
      documentId: string;
      from: number;
      to: number;
    }): Promise<Result<RetrievedChunk[], AppError>>;
  };
  memories: { remember(content: string): Promise<Result<string, AppError>> };
}

export interface AnsweringAgent {
  /** Dispatch the first search without waiting to be asked. See ADR 0005. */
  warm(query: string): void;
  stream(query: string, signal?: AbortSignal): AsyncGenerator<StreamEvent>;
  /** The chunk ids every search returned, in order, for persistence as citations. */
  citedChunkIds(): string[];
  /** The answer text as streamed, for one `append_message` at the end. */
  answerText(): string;
  systemPrompt(): string;
}

const buildSystemPrompt = (context: ChatContext): string => {
  const documents =
    context.documents.length === 0
      ? "No documents are attached to this conversation."
      : context.documents
          .map((d) => `- ${d.title} (${d.kind}, ${d.status}, ${d.chunkCount} passages)`)
          .join("\n");

  const memories =
    context.memories.length === 0
      ? ""
      : `\nWhat you know about them from earlier conversations:\n${context.memories.map((m) => `- ${m}`).join("\n")}\n`;

  const name = context.profile.displayName
    ? ` You are talking to ${context.profile.displayName}.`
    : "";

  // Deliberately short. The old prompt-engineering module generated adaptive
  // system prompts of several hundred lines, and every token of a system prompt
  // is billed on every turn of every conversation.
  return `You answer questions about the user's documents.${name}

Attached documents:
${documents}
${memories}
Search before answering anything about document content. Cite the passage a claim
came from by its number. When the answer is not in these documents, say so
plainly rather than answering from general knowledge.`;
};

export const createAnsweringAgent = ({
  context,
  model,
  retrieval,
  chunks,
  memories,
}: Dependencies): AnsweringAgent => {
  const citations: string[] = [];
  let answer = "";

  /**
   * The speculative first search. Retrieval for the raw user query is dispatched
   * in parallel with the first model call, so when the model does search — the
   * common case — the result is already there. If it does not search, the cost is
   * one embedding call, usually served from cache.
   */
  let warmed: Promise<Result<RetrievedChunk[], AppError>> | undefined;
  let warmedQuery: string | undefined;

  const cachingRetrieval = {
    async retrieve(request: RetrievalRequest) {
      if (warmed && warmedQuery === request.query) {
        const result = await warmed;
        warmed = undefined;
        return result;
      }

      return retrieval.retrieve(request);
    },
  };

  const tools = createTools({
    context,
    retrieval: cachingRetrieval,
    chunks,
    memories,
    onCitations: (ids) => {
      for (const id of ids) if (!citations.includes(id)) citations.push(id);
    },
  });

  const systemPrompt = buildSystemPrompt(context);

  const agent = createAgent({
    model,
    tools,
    middleware: [toolCallLimitMiddleware({ runLimit: MAX_TOOL_CALLS })],
  });

  return {
    warm(query) {
      if (context.documents.length === 0) return;

      warmedQuery = query;
      warmed = retrieval.retrieve({
        query,
        documentIds: context.documents.map((d) => d.id),
        limit: 12,
      });
    },

    async *stream(query, signal) {
      const history = context.messages.map((message) => ({
        role: message.role,
        content: message.parts
          .filter((part) => part.kind === "text" && part.text)
          .map((part) => part.text)
          .join("\n"),
      }));

      const stream = await agent.stream(
        {
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: query },
          ],
        },
        { streamMode: "messages", signal },
      );

      for await (const chunk of stream) {
        const [message, metadata] = chunk as [
          { content?: unknown; tool_calls?: unknown[]; getType?: () => string },
          { langgraph_node?: string },
        ];

        const text = typeof message?.content === "string" ? message.content : "";
        const isFromModel = metadata?.langgraph_node !== "tools";

        if (text && isFromModel) answer = text;

        yield {
          event: "messages/partial",
          data: [
            {
              type: isFromModel ? "ai" : "tool",
              content: message?.content ?? "",
              tool_calls: message?.tool_calls ?? [],
            },
          ],
        };
      }

      yield { event: "messages/complete", data: [{ type: "ai", content: answer }] };
    },

    citedChunkIds: () => [...citations],
    answerText: () => answer,
    systemPrompt: () => systemPrompt,
  };
};
