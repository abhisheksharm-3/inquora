import { AppError } from "@/core/errors";
import { drainIngestionQueue } from "@/server/modules/ingestion/ingestion.factory";
import { problemResponse } from "@/server/platform/http/problem";

/**
 * The endpoint the queue pokes and the schedule calls.
 *
 * It drains up to a handful of jobs and returns. Long-running work in a request
 * is what put fourteen documents in a failed state with no path forward, so this
 * takes one bite and lets the next poke take the next.
 */
const MAX_JOBS_PER_CALL = 5;

export async function POST(request: Request) {
  const instance = "/api/ingestion/drain";

  // The queue is service-role work, so the caller proves it is the queue rather
  // than anyone who found the URL.
  const secret = process.env.INGESTION_WORKER_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return problemResponse(AppError.unauthorized("this endpoint is not public"), instance);
  }

  const result = await drainIngestionQueue(MAX_JOBS_PER_CALL);

  if (!result.ok) return problemResponse(result.error, instance);

  return Response.json(result.value);
}
