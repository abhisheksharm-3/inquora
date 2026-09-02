import { AppError } from "@/core/errors";
import { chatServiceForRequest } from "@/server/modules/chat/chat.factory";
import { chatIdParam, sendMessageRequest } from "@/server/modules/chat/chat.schema";
import { problemResponse } from "@/server/platform/http/problem";
import { sseHeaders } from "@/server/platform/http/sse";

/**
 * No `runtime` export: cacheComponents rejects the segment config, and Node is
 * already the default for a route handler, which is what the model client and the
 * document parsers need.
 *
 * A tool-calling answer is at least two model turns, and the measured happy path
 * is 6.5 seconds. The platform default would cut a slow one mid-stream.
 */
export const maxDuration = 60;

/**
 * The one endpoint that answers a question.
 *
 * A route handler rather than a server action: actions cannot stream partial
 * results, cannot be cleanly aborted, and serialize through the RSC protocol.
 * Token streaming, stop-generation and HTTP observability all need a real
 * endpoint.
 *
 * Everything here is transport. Reading a body, validating it, and turning a
 * Result into either a stream or a problem document is the whole job.
 */
export async function POST(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const instance = `/api/chats/${chatId}/messages`;

  if (!chatIdParam.safeParse(chatId).success) {
    return problemResponse(AppError.badRequest("that is not a chat id"), instance);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return problemResponse(AppError.badRequest("the request body is not JSON"), instance);
  }

  const parsed = sendMessageRequest.safeParse(body);

  if (!parsed.success) {
    return problemResponse(
      AppError.badRequest(parsed.error.issues.map((issue) => issue.message).join("; ")),
      instance,
    );
  }

  const service = await chatServiceForRequest();

  // Unauthenticated, or over the message limit, before any provider is touched.
  if (!service.ok) return problemResponse(service.error, instance);

  const result = await service.value.send({
    chatId,
    content: parsed.data.content,
    parentId: parsed.data.parentId,
    clientMessageId: parsed.data.clientMessageId,
    // The handler watches the client going away, so an abandoned generation
    // stops costing money and still stores what it produced.
    signal: request.signal,
  });

  if (!result.ok) return problemResponse(result.error, instance);

  return new Response(result.value, { headers: sseHeaders });
}
