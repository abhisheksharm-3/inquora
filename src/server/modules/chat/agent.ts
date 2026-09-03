import { createAgent, toolCallLimitMiddleware } from "langchain";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";
import { DEFAULT_RETRIEVAL_LIMIT } from "@/core/retrieval/retrieval.constants";
import type { DocumentKind } from "@/server/modules/documents/documents.schema";
import type { RetrievalRequest, RetrievedChunk } from "@/server/modules/retrieval/retrieval.schema";
import { MAX_TOOL_CALLS } from "./chat.constants";
import type { ChatContext } from "./chat.schema";
import type { AgentDependencies, AnsweringAgent, Specimen, TurnUsage } from "./chat.types";
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

  /*
   * Who is asking and what day it is.
   *
   * A model has neither unless it is told. Asked "what date is today" it
   * answered "I don't have access to the current date", and asked "what is my
   * name" it went and searched the documents for one — both reasonable, both
   * avoidable, and both things the old system supplied. The date matters for
   * more than pleasantries: a question like "how many months has he worked
   * here" is unanswerable from a document that only holds a start date.
   *
   * Written as a long date rather than an ISO string, because that is how it
   * will be repeated back.
   */
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date());

  const reader = context.profile.displayName
    ? `You are talking to ${context.profile.displayName}.`
    : "You do not know the reader's name.";

  // Deliberately no adaptive prose beyond this. The old prompt-engineering module
  // generated several hundred lines per turn, and every system-prompt token is
  // billed on every turn of every conversation.
  return `You answer questions about the user's documents.

${reader} Today is ${today}. Those two facts are yours to use directly: a
question about the reader, about today, or about how long ago something in a
document was, is answered from here rather than by searching for it.

Attached:
${documents}
${memories}
How to work with what is attached:

${specialists}

Always: search before answering anything about document content, and when the
answer is not in these documents say so plainly rather than answering from
general knowledge.

Cite by copying the number in the square brackets at the start of a passage,
like [1], and writing it immediately after the claim that passage supports.

That bracketed number is the only citation there is. It counts up from 1 within
this answer, so a citation is never a page number, a line number, or a position
inside a document. Copy it exactly, never renumber, and never write a number you
have not been shown. A claim about document content with no number after it
reads to the reader as unsupported.${
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
  const specimenQueue: Specimen[] = [];
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
    onCitations: (chunks): number[] =>
      // A specimen number is the passage's position in the turn's citation
      // order, one-based, and it never moves once assigned: a passage the model
      // searches for twice keeps the number the reader already saw.
      chunks.map((chunk) => {
        const seen = citations.indexOf(chunk.chunkId);
        if (seen !== -1) return seen + 1;

        citations.push(chunk.chunkId);

        // Queued rather than yielded, because a tool runs inside the model
        // loop and has no access to the generator. The loop drains this on its
        // next turn, which is why a specimen reaches the reader before the
        // sentence citing it finishes.
        specimenQueue.push({
          number: citations.length,
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          documentTitle:
            context.documents.find((document) => document.id === chunk.documentId)?.title ??
            "Untitled",
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
        });

        return citations.length;
      }),
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
        // Drained first, so a passage the model has just read is in the
        // apparatus before the text quoting it arrives.
        for (const specimen of specimenQueue.splice(0)) {
          yield { event: "specimen", data: specimen };
        }

        const [message, metadata] = chunk as [
          {
            content?: unknown;
            tool_calls?: unknown[];
            usage_metadata?: { input_tokens?: number; output_tokens?: number };
            response_metadata?: {
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
            };
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

        /*
         * Usage arrives on the final chunk of each model turn, and a
         * tool-calling turn produces several, so they accumulate rather than
         * overwrite.
         *
         * Two shapes are read because only one of them turned up. LangChain
         * normalises usage to `usage_metadata.input_tokens`, and Gemini's own
         * field is `usageMetadata.promptTokenCount` under response metadata.
         * Reading only the normalised one left every message in the database
         * with null tokens while recording a real latency, so what an answer
         * cost was unknowable.
         */
        const meta = message?.usage_metadata;
        const raw = message?.response_metadata?.usageMetadata;

        const tokensIn = meta?.input_tokens ?? raw?.promptTokenCount;
        const tokensOut = meta?.output_tokens ?? raw?.candidatesTokenCount;

        if (typeof tokensIn === "number") usage.tokensIn = (usage.tokensIn ?? 0) + tokensIn;
        if (typeof tokensOut === "number") usage.tokensOut = (usage.tokensOut ?? 0) + tokensOut;

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

      for (const specimen of specimenQueue.splice(0)) {
        yield { event: "specimen", data: specimen };
      }

      yield { event: "messages/complete", data: [{ type: "ai", content: answer }] };
    },

    citedChunkIds: () => [...citations],
    answerText: () => answer,
    usage: () => ({ ...usage, retrievalMs, warmHits, warmMisses }),
    systemPrompt: () => systemPrompt,
  };
};
