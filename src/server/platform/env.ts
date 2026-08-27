import { z } from "zod";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

/**
 * Every environment variable this application reads, in one schema, validated
 * once. The previous configuration declared some variables here while seven
 * RAG_* values were read straight from process.env, four of which were never
 * declared anywhere.
 *
 * An optional provider is optional in the schema. A missing Redis is a known
 * state the caller handles, not a crash at boot and not a second in-process
 * implementation.
 */
const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

    // The Hugging Face Space that serves embeddings, subtitles and
    // transcription. The URL has a default because it is public; the key does
    // not, because requests without x-api-key are refused with 401.
    EMBEDDINGS_BASE_URL: z
      .string()
      .url()
      .default("https://abhisheksan-multiutility-server.hf.space"),
    MULTIUTILITY_API_KEY: z.string().min(1).optional(),

    GEMINI_API_KEY: z.string().min(1).optional(),

    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

    SITE_URL: z.string().url().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  })
  .refine((v) => !v.UPSTASH_REDIS_REST_URL || Boolean(v.UPSTASH_REDIS_REST_TOKEN), {
    path: ["UPSTASH_REDIS_REST_TOKEN"],
    message: "required when UPSTASH_REDIS_REST_URL is set",
  });

export type Env = z.infer<typeof schema>;

/**
 * Parses an environment object. Takes the object rather than reading
 * process.env, so the failure paths are testable and Next's build-time
 * substitution of NEXT_PUBLIC_* still happens at the call site.
 */
export const parseEnv = (source: Record<string, string | undefined>): Result<Env, AppError> => {
  const parsed = schema.safeParse(source);

  if (parsed.success) return ok(parsed.data);

  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");

  return err(AppError.misconfigured(detail));
};

let cached: Env | undefined;

/**
 * The validated environment. Throws on first access if the environment is
 * wrong, which is the one place throwing is right: there is no request to
 * return a status code to yet.
 */
export const env = (): Env => {
  if (cached) return cached;

  const result = parseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EMBEDDINGS_BASE_URL: process.env.EMBEDDINGS_BASE_URL,
    MULTIUTILITY_API_KEY: process.env.MULTIUTILITY_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SITE_URL: process.env.SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!result.ok) throw result.error;

  cached = result.value;
  return cached;
};
