import { Redis } from "@upstash/redis";
import { createChunksRepository } from "@/server/modules/retrieval/chunks.repository";
import { createRetrievalRepository } from "@/server/modules/retrieval/retrieval.repository";
import { createRetrievalService } from "@/server/modules/retrieval/retrieval.service";
import { createMemoryRepository } from "@/server/modules/memory/memory.repository";
import { createCache } from "@/server/platform/cache/cache";
import { createServerDbClient } from "@/server/platform/db/client";
import { createEmbeddingsClient } from "@/server/platform/embeddings/client";
import { env } from "@/server/platform/env";
import { createChatModel } from "@/server/platform/llm/model";
import { createChatRepository } from "./chat.repository";
import { createChatService, type ChatService } from "./chat.service";

/**
 * Wires the chat service for one request.
 *
 * The route handler is transport: it reads a body, returns a stream or a problem
 * document, and knows nothing about which provider serves embeddings or where the
 * cache lives. The dependency rule says app reaches modules, and modules reach
 * platform, so the composition happens here rather than in the handler.
 */
export const chatServiceForRequest = async (): Promise<ChatService> => {
  const configuration = env();
  const db = await createServerDbClient();

  const cache = createCache({
    redis:
      configuration.UPSTASH_REDIS_REST_URL && configuration.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: configuration.UPSTASH_REDIS_REST_URL,
            token: configuration.UPSTASH_REDIS_REST_TOKEN,
          })
        : undefined,
  });

  return createChatService({
    repository: createChatRepository(db),
    retrieval: createRetrievalService({
      embeddings: createEmbeddingsClient({
        baseUrl: configuration.EMBEDDINGS_BASE_URL,
        apiKey: configuration.MULTIUTILITY_API_KEY ?? "",
      }),
      repository: createRetrievalRepository(db),
      cache,
    }),
    chunks: createChunksRepository(db),
    memories: createMemoryRepository(db),
    model: () =>
      createChatModel({
        apiKey: configuration.GEMINI_API_KEY,
        model: configuration.ANSWER_MODEL,
      }),
  });
};
