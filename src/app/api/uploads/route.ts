import { AppError } from "@/core/errors";
import { requestUploadTicket } from "@/server/modules/documents/documents.factory";
import { uploadRequest } from "@/server/modules/documents/documents.schema";
import { problemResponse } from "@/server/platform/http/problem";

/**
 * Asks for somewhere to put a file. The bytes go straight from the browser to
 * storage with the URL this returns, so no request body carries a 50MB file.
 */
export async function POST(request: Request) {
  const instance = "/api/uploads";

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return problemResponse(AppError.badRequest("the request body is not JSON"), instance);
  }

  const parsed = uploadRequest.safeParse(body);

  if (!parsed.success) {
    return problemResponse(
      AppError.badRequest(
        parsed.error.issues.map((issue: { message: string }) => issue.message).join("; "),
      ),
      instance,
    );
  }

  const result = await requestUploadTicket(parsed.data);

  if (!result.ok) return problemResponse(result.error, instance);

  return Response.json(result.value, { status: result.value.alreadyIndexed ? 200 : 201 });
}
