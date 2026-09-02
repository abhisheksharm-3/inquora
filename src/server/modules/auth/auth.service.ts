import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import { createServerDbClient } from "@/server/platform/db/client";
import { siteUrl } from "@/server/platform/env";
import { rateLimiter } from "@/server/platform/ratelimit/redis";

/**
 * Signing in, signing up, and exchanging an OAuth code.
 *
 * These live in a module rather than in the server action because the rules
 * around them are not transport rules: how many times a password may be guessed,
 * where an email confirmation link points, and what happens to the profile row.
 * The action reads a form and returns a message; that is all it should know.
 *
 * The profile row is not written here. The on_auth_user_created trigger does it,
 * which is why the old code's two separate writes — one in the callback, one in a
 * hook — are both gone.
 */

export const signInWithPassword = async (
  email: string,
  password: string,
): Promise<Result<void, AppError>> => {
  const allowed = await rateLimiter().check("auth", `login:${email}`);
  if (!allowed.ok) return err(allowed.error);

  const db = await createServerDbClient();
  const { error } = await db.auth.signInWithPassword({ email, password });

  // The provider's message is passed through: "Invalid login credentials" is
  // exactly what the person needs to read, and inventing a friendlier one loses
  // the difference between a wrong password and an unconfirmed email.
  if (error) return err(AppError.unauthorized(error.message));

  return ok(undefined);
};

export const signUpWithPassword = async (
  email: string,
  password: string,
  fullName: string,
): Promise<Result<void, AppError>> => {
  const allowed = await rateLimiter().check("auth", `signup:${email}`);
  if (!allowed.ok) return err(allowed.error);

  const db = await createServerDbClient();

  const { error } = await db.auth.signUp({
    email,
    password,
    // full_name is read by the trigger to fill profiles.display_name.
    options: { data: { full_name: fullName } },
  });

  if (error) return err(AppError.badRequest(error.message));

  return ok(undefined);
};

export const startGoogleSignIn = async (
  nextPath?: string | null,
): Promise<Result<{ url: string }, AppError>> => {
  const db = await createServerDbClient();

  const callback = new URL("/api/auth/callback", siteUrl());
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    callback.searchParams.set("next", nextPath);
  }

  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) {
    return err(AppError.badGateway(error?.message ?? "the provider returned no redirect"));
  }

  return ok({ url: data.url });
};

export const completeOAuthSignIn = async (code: string): Promise<Result<void, AppError>> => {
  const db = await createServerDbClient();
  const { error } = await db.auth.exchangeCodeForSession(code);

  if (error) return err(AppError.unauthorized(error.message));

  return ok(undefined);
};
