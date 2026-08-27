import { AppError } from "@/core/errors";
import { chatServiceForRequest } from "@/server/modules/chat/chat.factory";
import { sendMessageRequest } from "@/server/modules/chat/chat.schema";
import { problemResponse } from "@/server/platform/http/problem";
import { sseHeaders } from "@/server/platform/http/sse";

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
