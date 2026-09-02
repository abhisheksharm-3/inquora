import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { RetrievedChunk } from "@/server/modules/retrieval/retrieval.schema";
import { streamToSse } from "@/server/platform/http/sse";
import { startSpan } from "@/server/platform/telemetry/span";
import { createAnsweringAgent } from "./agent";
import { resolveQuestion } from "./resolve-question";
import type { SendMessageRequest } from "./chat.schema";
import type { ChatService, ChatServiceDependencies } from "./chat.types";

export const createChatService = ({
  repository,
  retrieval,
  chunks,
  memories,
  tables,
  structure,
  slices,
  web,
  model,
}: ChatServiceDependencies): ChatService => ({
  async send({ chatId, content, parentId, signal }) {
    const started = Date.now();
    const span = startSpan("answer", { chat: chatId, characters: content.length });

    const fail = (error: AppError) => {
      span.fail(error);
      span.end();
      return err(error);
    };

    const context = await repository.context(chatId);
    if (!context.ok) return fail(context.error);

    // A document mid-ingestion has no chunks, so answering from it would answer
    // from nothing. 409 with a real fraction is more use than a confident wrong
    // answer; the UI shows chunkCount against expected_chunks.
    const attached = context.value.documents;
    if (attached.length > 0 && attached.every((d) => d.chunkCount === 0)) {
      const processing = attached.filter(
        (d) => d.status === "processing" || d.status === "pending",
      );

      if (processing.length === attached.length) {
        return fail(
          AppError.conflict(
            `still indexing ${processing.length === 1 ? "this document" : `these ${processing.length} documents`}`,
          ),
        );
      }
    }

    const chatModel = await model();
    if (!chatModel.ok) return fail(chatModel.error);

    // The question is stored before generation. The old path stored nothing until
    // the answer came back, so a crash mid-generation lost the question too.
    const user = await repository.append({
      chatId,
      role: "user",
      content,
      parentId,
      citationChunkIds: [],
    });
    if (!user.ok) return fail(user.error);

    // "What about the second one?" cannot be searched as written: the vector
    // describes the grammar rather than the subject. The heuristic inside this
    // decides whether it is worth a call, and a self-contained question skips it.
    const { question, resolved } = await resolveQuestion(content, context.value, chatModel.value);

    span.set({ documents: attached.length, question_resolved: resolved });

    const agent = createAnsweringAgent({
      context: context.value,
      model: chatModel.value,
      retrieval,
      chunks,
      memories,
      tables,
      structure,
      slices,
      web,
    });

    // Dispatched before the first model call rather than after it, so the common
    // path does not pay for retrieval twice over. See ADR 0005. The resolved
    // question is what gets pre-warmed, because that is what the model will search.
    agent.warm(question);

    return ok(
      streamToSse(agent.stream(question, signal), {
        signal,
        onFinish: async (outcome) => {
          const answer = agent.answerText();

          // An aborted generation still persists what it produced — the user saw
          // it and it was paid for. A failed one does not: storing half a
          // sentence as a finished answer means the next turn reasons from it.
          if (answer.length === 0 || outcome === "failed") {
            span.set({ outcome });
            span.end();
            return;
          }

          const usage = agent.usage();

          span.set({
            outcome,
            tokens_in: usage.tokensIn,
            tokens_out: usage.tokensOut,
            model: usage.model,
            retrieval_ms: usage.retrievalMs,
            latency_ms: Date.now() - started,
            citations: agent.citedChunkIds().length,
          });
          span.end();

          const stored = await repository.append({
            chatId,
            role: "assistant",
            content: answer,
            parentId: user.value,
            citationChunkIds: agent.citedChunkIds(),
            latencyMs: Date.now() - started,
            retrievalMs: usage.retrievalMs,
            tokensIn: usage.tokensIn,
            tokensOut: usage.tokensOut,
            model: usage.model,
          });

          // The client has already read the answer, so there is no status code
          // left to return. An unrecorded answer is the worst outcome here, so it
          // is at least recorded in the trace.
          if (!stored.ok) span.fail(stored.error);
        },
      }),
    );
  },
});
