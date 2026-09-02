import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { RetrievalRequest, RetrievedChunk } from "@/server/modules/retrieval/retrieval.schema";
import { streamToSse } from "@/server/platform/http/sse";
import { createAnsweringAgent } from "./agent";
import type { SendMessageRequest } from "./chat.schema";

export const createChatService = ({
  repository,
  retrieval,
  chunks,
  memories,
  model,
}: ChatServiceDependencies): ChatService => ({
  async send({ chatId, content, parentId, signal }) {
    const started = Date.now();

    const context = await repository.context(chatId);
    if (!context.ok) return err(context.error);

    // A document mid-ingestion has no chunks, so answering from it would answer
    // from nothing. 409 with a real fraction is more use than a confident wrong
    // answer; the UI shows chunkCount against expected_chunks.
    const attached = context.value.documents;
    if (attached.length > 0 && attached.every((d) => d.chunkCount === 0)) {
      const processing = attached.filter(
        (d) => d.status === "processing" || d.status === "pending",
      );

      if (processing.length === attached.length) {
        return err(
          AppError.conflict(
            `still indexing ${processing.length === 1 ? "this document" : `these ${processing.length} documents`}`,
          ),
        );
      }
    }

    const chatModel = await model();
    if (!chatModel.ok) return err(chatModel.error);

    // The question is stored before generation. The old path stored nothing until
    // the answer came back, so a crash mid-generation lost the question too.
    const user = await repository.append({
      chatId,
      role: "user",
      content,
      parentId,
      citationChunkIds: [],
    });
    if (!user.ok) return err(user.error);

    const agent = createAnsweringAgent({
      context: context.value,
      model: chatModel.value,
      retrieval,
      chunks,
      memories,
    });

    // Dispatched before the first model call rather than after it, so the common
    // path does not pay for retrieval twice over. See ADR 0005.
    agent.warm(content);

    return ok(
      streamToSse(agent.stream(content, signal), {
        signal,
        onFinish: async () => {
          const answer = agent.answerText();

          // An aborted generation still persists what it produced. Nothing is
          // written when there is nothing to write, and an error is never stored
          // as an assistant turn.
          if (answer.length === 0) return;

          const usage = agent.usage();

          await repository.append({
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
        },
      }),
    );
  },
});
import type { ChatService, ChatServiceDependencies, SendArgs } from "./chat.types";
