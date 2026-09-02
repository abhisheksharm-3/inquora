import { createClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import type { Database } from "@/core/database.types";
import { env } from "@/server/platform/env";

/**
 * The service-role client, for work that runs without a user: the ingestion
 * worker claiming jobs and writing chunks.
 *
 * It bypasses row-level security, so it is built only here and only for the
 * worker. Nothing that serves a request may use it — a request-shaped call must
 * see the caller's own rows, which is what createServerDbClient is for.
 */
export const createServiceDbClient = (): Result<
  ReturnType<typeof createClient<Database>>,
  AppError
> => {
  const configuration = env();

  if (!configuration.SUPABASE_SERVICE_ROLE_KEY) {
    return err(
      AppError.misconfigured("SUPABASE_SERVICE_ROLE_KEY is not set, so the worker cannot run"),
    );
  }

  return ok(
    createClient<Database>(
      configuration.NEXT_PUBLIC_SUPABASE_URL,
      configuration.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
};
