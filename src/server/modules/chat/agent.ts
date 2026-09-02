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
plainly rather than answering from general knowledge.

For a spreadsheet, query it rather than searching it: list_tables then
query_table. Searching the text of a sheet can find the right region and cannot
add up a column.`;
};

export const createAnsweringAgent = ({
  context,
  model,
  retrieval,
  chunks,
  memories,
  tables,
}: AgentDependencies): AnsweringAgent => {
  const citations: string[] = [];
  let answer = "";
  let retrievalMs = 0;
  const usage: TurnUsage = { retrievalMs: 0 };

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
      const startedAt = Date.now();

      try {
        if (warmed && warmedQuery === request.query) {
          const result = await warmed;
          warmed = undefined;
          return result;
        }

        return await retrieval.retrieve(request);
      } finally {
        // Counted whether the search was served from the speculative dispatch or
        // not, because what matters is how long the answer waited on retrieval.
        retrievalMs += Date.now() - startedAt;
      }
    },
  };

  const tools = createTools({
    context,
    retrieval: cachingRetrieval,
    chunks,
    memories,
    tables,
    onCitations: (ids: string[]) => {
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
        documentIds: context.documents.map((d: { id: string }) => d.id),
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
          {
            content?: unknown;
            tool_calls?: unknown[];
            usage_metadata?: { input_tokens?: number; output_tokens?: number };
            response_metadata?: { model_name?: unknown; model?: unknown };
          },
          { langgraph_node?: string },
        ];

        const text = typeof message?.content === "string" ? message.content : "";
        const isFromModel = metadata?.langgraph_node !== "tools";

        if (text && isFromModel) answer = text;

        // Usage arrives on the final chunk of each model turn, and a tool-calling
        // turn produces several, so they accumulate rather than overwrite.
        const meta = message?.usage_metadata;

        if (meta) {
          usage.tokensIn = (usage.tokensIn ?? 0) + (meta.input_tokens ?? 0);
          usage.tokensOut = (usage.tokensOut ?? 0) + (meta.output_tokens ?? 0);
        }

        const named = message?.response_metadata?.model_name ?? message?.response_metadata?.model;
        if (typeof named === "string") usage.model = named;

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
    usage: () => ({ ...usage, retrievalMs }),
    systemPrompt: () => systemPrompt,
  };
};
import type { AgentDependencies, AnsweringAgent, TurnUsage } from "./chat.types";

export type { AnsweringAgent, TurnUsage } from "./chat.types";
