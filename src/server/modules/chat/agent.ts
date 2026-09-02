import { createAgent, toolCallLimitMiddleware } from "langchain";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";
import { DEFAULT_RETRIEVAL_LIMIT } from "@/core/retrieval/retrieval.constants";
import type { DocumentKind } from "@/server/modules/documents/documents.schema";
import type { RetrievalRequest, RetrievedChunk } from "@/server/modules/retrieval/retrieval.schema";
import { MAX_TOOL_CALLS } from "./chat.constants";
import type { ChatContext } from "./chat.schema";
import type { AgentDependencies, AnsweringAgent, TurnUsage } from "./chat.types";
import { SPECIALISTS, specialistsFor } from "./kinds/specialists";
import { createTools } from "./tools";

/**
 * Whether two searches are close enough that the same passages come back.
 *
 * Not string equality, which is what made the speculative dispatch nearly always
 * wasted: "why did Q3 revenue miss?" and "Q3 revenue shortfall reasons" are the
 * same search. Compared on the words that carry meaning, so word order,
 * punctuation and the small words do not decide it.
 */
const sameSearch = (a: string, b: string): boolean => {
  const terms = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((word) => word.length > 3) ?? [],
    );

  const first = terms(a);
  const second = terms(b);

  if (first.size === 0 || second.size === 0) return false;

  let shared = 0;
  for (const term of second) if (first.has(term)) shared += 1;

  // Most of what the model asked for was in what was already fetched.
  return shared / second.size >= 0.6;
};

const buildSystemPrompt = (context: ChatContext): string => {
  if (context.documents.length === 0) {
    return [
      "You answer questions about the user's documents. None are attached to this",
      "conversation yet, so answer questions about the conversation itself and say plainly that",
      "there is nothing to search.",
    ].join(" ");
  }

  const documents = context.documents
    .map(
      (d) =>
        `- ${d.title} — ${SPECIALISTS[d.kind as DocumentKind]?.label ?? d.kind}, ${d.status}, ${d.chunkCount} passages, id ${d.id}`,
    )
    .join("\n");

  // The specialist sections are what make this worth composing rather than
  // writing once. A repository and a spreadsheet are answered by different tools
  // in a different order, and a model told only "documents" treats them alike.
  const specialists = specialistsFor(context.documents.map((d) => d.kind))
    .map((specialist) => {
      const caveat = specialist.caveat ? `\n  Limits: ${specialist.caveat}` : "";
      return `${specialist.label.replace(/^a /, "").toUpperCase()}\n  ${specialist.guidance}${caveat}`;
    })
    .join("\n\n");

  const memories =
    context.memories.length === 0
      ? ""
      : `\nWhat you know about them from earlier conversations:\n${context.memories.map((m) => `- ${m}`).join("\n")}\n`;

  const name = context.profile.displayName
    ? ` You are talking to ${context.profile.displayName}.`
    : "";

  // Deliberately no adaptive prose beyond this. The old prompt-engineering module
  // generated several hundred lines per turn, and every system-prompt token is
  // billed on every turn of every conversation.
  return `You answer questions about the user's documents.${name}

Attached:
${documents}
${memories}
How to work with what is attached:

${specialists}

Always: search before answering anything about document content, cite the passage
a claim came from, and when the answer is not in these documents say so plainly
rather than answering from general knowledge.${
    context.chat.webSearch
      ? `

Web search is on for this conversation. Use it only for what the attached
documents cannot answer, and mark plainly which parts of your answer came from
the web rather than from the user's own documents.`
      : ""
  }`;
};

export const createAnsweringAgent = ({
  context,
  model,
  retrieval,
  chunks,
  memories,
  tables,
  structure,
  slices,
  web,
}: AgentDependencies): AnsweringAgent => {
  const citations: string[] = [];
  let answer = "";
  let retrievalMs = 0;
  const usage: TurnUsage = { retrievalMs: 0, warmHits: 0, warmMisses: 0 };

  /**
   * The speculative first search: retrieval for the user's question, dispatched
   * in parallel with the first model call so the common case does not wait for it.
   *
   * Reuse used to require the model's search string to equal the question
   * character for character, and the model writes its own string — so a
   * paraphrase discarded a whole embedding call and a whole search, unmeasured.
   * It is reused whenever the model's query is close enough that the same
   * passages would come back, and every decision is recorded so the hit rate is a
   * number rather than a hope.
   */
  let warmed: Promise<Result<RetrievedChunk[], AppError>> | undefined;
  let warmedQuery: string | undefined;
  let warmHits = 0;
  let warmMisses = 0;

  const cachingRetrieval = {
    async retrieve(request: RetrievalRequest) {
      const startedAt = Date.now();

      try {
        if (warmed && warmedQuery && sameSearch(warmedQuery, request.query)) {
          const result = await warmed;
          warmed = undefined;
          warmHits += 1;
          return result;
        }

        if (warmed) warmMisses += 1;

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
    structure,
    slices,
    web,
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
        limit: DEFAULT_RETRIEVAL_LIMIT,
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

        // Appended, not assigned. streamMode "messages" yields deltas, so a
        // real provider sends an answer as tens of chunks and assigning kept only
        // the last one: a 44-chunk answer persisted as ".". The client is sent the
        // same deltas below, so the stored text is exactly what was displayed.
        if (text && isFromModel) answer += text;

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
    usage: () => ({ ...usage, retrievalMs, warmHits, warmMisses }),
    systemPrompt: () => systemPrompt,
  };
};
