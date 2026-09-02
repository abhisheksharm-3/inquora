import { timingSafeEqual } from "node:crypto";
import { AppError } from "@/core/errors";
import { drainIngestionQueue } from "@/server/modules/ingestion/ingestion.factory";
import { problemResponse } from "@/server/platform/http/problem";

/**
 * Extraction reads a file and embeds it in batches, which is slower than a
 * request that only reads the database.
 */
export const maxDuration = 300;

/**
 * The queue is service-role work, so the caller proves it is the queue rather
 * than anyone who found the URL. Compared in constant time: the comparison is
 * cheap and a shared secret is what timing attacks are for.
 */
function authorized(request: Request): boolean {
  const secret = process.env.INGESTION_WORKER_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || !provided || provided.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

/**
 * The endpoint the queue pokes and the schedule calls.
 *
 * It drains up to a handful of jobs and returns. Long-running work in a request
 * is what put fourteen documents in a failed state with no path forward, so this
 * takes one bite and lets the next poke take the next.
 */
const MAX_JOBS_PER_CALL = 5;

/**
 * What this deployment has configured, by name, never by value.
 *
 * Behind the same bearer as the drain, because it describes the deployment. It
 * exists because a 500 that correctly withholds its detail from a client also
 * withholds it from whoever is trying to work out which variable is missing, and
 * "read the function logs" is not available to everyone who can deploy.
 */
export async function GET(request: Request) {
  const instance = "/api/ingestion/drain";

  if (!authorized(request)) {
    return problemResponse(AppError.unauthorized("this endpoint is not public"), instance);
  }

  const present = (name: string) => Boolean(process.env[name]);

  return Response.json({
    configured: {
      NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
      MULTIUTILITY_API_KEY: present("MULTIUTILITY_API_KEY"),
      GEMINI_API_KEY: present("GEMINI_API_KEY"),
      UPSTASH_REDIS_REST_URL: present("UPSTASH_REDIS_REST_URL"),
      UPSTASH_REDIS_REST_TOKEN: present("UPSTASH_REDIS_REST_TOKEN"),
      INGESTION_WORKER_SECRET: present("INGESTION_WORKER_SECRET"),
      ANSWER_MODEL: process.env.ANSWER_MODEL ?? "(default)",
      TAVILY_API_KEY: present("TAVILY_API_KEY"),
      GITHUB_TOKEN: present("GITHUB_TOKEN"),
      SENTRY_DSN: present("SENTRY_DSN"),
      LANGFUSE_PUBLIC_KEY: present("LANGFUSE_PUBLIC_KEY"),
    },
    region: process.env.VERCEL_REGION ?? "(unknown)",
  });
}

export async function POST(request: Request) {
  const instance = "/api/ingestion/drain";

  if (!authorized(request)) {
    return problemResponse(AppError.unauthorized("this endpoint is not public"), instance);
  }

  const result = await drainIngestionQueue(MAX_JOBS_PER_CALL);

  if (!result.ok) return problemResponse(result.error, instance);

  return Response.json(result.value);
}
