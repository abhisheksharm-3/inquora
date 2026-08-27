import { Redis } from "@upstash/redis";
import { AppError } from "@/core/errors";
import { createChatRepository } from "@/server/modules/chat/chat.repository";
import { sendMessageRequest } from "@/server/modules/chat/chat.schema";
import { createChatService } from "@/server/modules/chat/chat.service";
import { createMemoryRepository } from "@/server/modules/memory/memory.repository";
import { createChunksRepository } from "@/server/modules/retrieval/chunks.repository";
import { createRetrievalRepository } from "@/server/modules/retrieval/retrieval.repository";
import { createRetrievalService } from "@/server/modules/retrieval/retrieval.service";
import { createCache } from "@/server/platform/cache/cache";
import { createServerDbClient } from "@/server/platform/db/client";
import { createEmbeddingsClient } from "@/server/platform/embeddings/client";
import { env } from "@/server/platform/env";
import { problemResponse } from "@/server/platform/http/problem";
import { sseHeaders } from "@/server/platform/http/sse";
import { createChatModel } from "@/server/platform/llm/model";

/**
 * The one endpoint that answers a question.
 *
 * A route handler rather than a server action: actions cannot stream partial
 * results, cannot be cleanly aborted, and serialize through the RSC protocol.
 * Token streaming, stop-generation and HTTP observability all need a real
 * endpoint.
 */
export async function POST(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const instance = `/api/chats/${chatId}/messages`;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return problemResponse(AppError.conflict("the request body is not JSON"), instance);
  }

  const parsed = sendMessageRequest.safeParse(body);

  if (!parsed.success) {
    return problemResponse(
      AppError.conflict(parsed.error.issues.map((i) => i.message).join("; ")),
      instance,
    );
  }

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

  const retrieval = createRetrievalService({
    embeddings: createEmbeddingsClient({
      baseUrl: configuration.EMBEDDINGS_BASE_URL,
      apiKey: configuration.MULTIUTILITY_API_KEY ?? "",
    }),
    repository: createRetrievalRepository(db),
    cache,
  });

  const service = createChatService({
    repository: createChatRepository(db),
    retrieval,
    chunks: createChunksRepository(db),
    memories: createMemoryRepository(db),
    model: () => createChatModel({ apiKey: configuration.GEMINI_API_KEY }),
  });

  const result = await service.send({
    chatId,
    content: parsed.data.content,
    parentId: parsed.data.parentId,
    // The handler watches the client going away, so an abandoned generation
    // stops costing money and still stores what it produced.
    signal: request.signal,
  });

  if (!result.ok) return problemResponse(result.error, instance);

  return new Response(result.value, { headers: sseHeaders });
}
