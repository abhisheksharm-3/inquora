import { Redis } from "@upstash/redis";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import { createChunksRepository } from "@/server/modules/retrieval/chunks.repository";
import { createRetrievalRepository } from "@/server/modules/retrieval/retrieval.repository";
import { createRetrievalService } from "@/server/modules/retrieval/retrieval.service";
import { createMemoryRepository } from "@/server/modules/memory/memory.repository";
import { createOutlineRepository } from "@/server/modules/documents/outline.repository";
import { createTablesRepository } from "@/server/modules/documents/tables.repository";
import { createCache } from "@/server/platform/cache/cache";
import { createServerDbClient } from "@/server/platform/db/client";
import { createEmbeddingsClient } from "@/server/platform/embeddings/client";
import { env } from "@/server/platform/env";
import { createChatModel } from "@/server/platform/llm/model";
import { rateLimiter } from "@/server/platform/ratelimit/redis";
import { createChatRepository } from "./chat.repository";
import { createChatService } from "./chat.service";
import type { ChatService } from "./chat.types";

/**
 * Wires the chat service for one request.
 *
 * The route handler is transport: it reads a body, returns a stream or a problem
 * document, and knows nothing about which provider serves embeddings or where the
 * cache lives. The dependency rule says app reaches modules, and modules reach
 * platform, so the composition happens here rather than in the handler.
 */
export const chatServiceForRequest = async (): Promise<Result<ChatService, AppError>> => {
  const configuration = env();
  const db = await createServerDbClient();

  // getUser, not getSession: getSession trusts whatever is in the cookie, while
  // getUser verifies the token with the auth server. Row-level security would
  // stop a stranger reading the chat either way, but a 401 says what is wrong
  // where a 404 would imply the conversation does not exist.
  const { data: identity } = await db.auth.getUser();

  if (!identity.user) {
    return err(AppError.unauthorized("sign in to send a message"));
  }

  // Each message costs at least one model turn, so this is the bucket that
  // actually protects the bill. It was built and then not applied here.
  const allowed = await rateLimiter().check("messages", identity.user.id);
  if (!allowed.ok) return err(allowed.error);

  const cache = createCache({
    redis:
      configuration.UPSTASH_REDIS_REST_URL && configuration.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: configuration.UPSTASH_REDIS_REST_URL,
            token: configuration.UPSTASH_REDIS_REST_TOKEN,
          })
        : undefined,
  });

  return ok(
    createChatService({
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
      tables: createTablesRepository(db),
      structure: createOutlineRepository(db),
      model: () =>
        createChatModel({
          apiKey: configuration.GEMINI_API_KEY,
          model: configuration.ANSWER_MODEL,
        }),
    }),
  );
};
