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

/**
 * Send a recovery link.
 *
 * Always answers ok, even for an address with no account. The alternative tells
 * a stranger which email addresses are registered here, and the person who owns
 * the address learns nothing either way: they either get the mail or they do
 * not.
 *
 * The link points at the same callback as OAuth, which exchanges the code for a
 * session and then sends them on to set a new password.
 */
/** Who is signed in, for the account menu. */
export const currentAccount = async (): Promise<
  Result<
    { id: string; email: string; displayName: string | null; avatarUrl: string | null },
    AppError
  >
> => {
  const db = await createServerDbClient();
  const { data: identity } = await db.auth.getUser();

  if (!identity.user) return err(AppError.unauthorized("not signed in"));

  // The display name lives on the profile row, which the on_auth_user_created
  // trigger fills from the sign-up metadata. Read from there rather than from
  // the auth metadata, so a later rename has one home.
  const { data: profile } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", identity.user.id)
    .maybeSingle();

  // Google puts the profile picture in the OAuth metadata, under `avatar_url`
  // on some providers and `picture` on others. Only the one host it can come
  // from is allowed in next.config, so a crafted value cannot make the image
  // optimiser fetch somewhere else.
  const metadata = identity.user.user_metadata as {
    avatar_url?: unknown;
    picture?: unknown;
    full_name?: unknown;
  };
  const avatar = [metadata.avatar_url, metadata.picture].find(
    (value) => typeof value === "string" && value.startsWith("https://"),
  );

  return ok({
    id: identity.user.id,
    email: identity.user.email ?? "",
    displayName:
      profile?.display_name ?? (typeof metadata.full_name === "string" ? metadata.full_name : null),
    avatarUrl: typeof avatar === "string" ? avatar : null,
  });
};

export const signOut = async (): Promise<Result<void, AppError>> => {
  const db = await createServerDbClient();
  const { error } = await db.auth.signOut();

  if (error) return err(AppError.badGateway(error.message));

  return ok(undefined);
};

export const startPasswordReset = async (email: string): Promise<Result<void, AppError>> => {
  const allowed = await rateLimiter().check("auth", `reset:${email}`);
  if (!allowed.ok) return err(allowed.error);

  const db = await createServerDbClient();

  const callback = new URL("/api/auth/callback", siteUrl());
  callback.searchParams.set("next", "/reset-password");

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: callback.toString(),
  });

  // Logged rather than returned. A provider outage should not be reported to
  // the caller as "that address does not exist".
  if (error) console.error("Could not send a recovery link:", error.message);

  return ok(undefined);
};

/**
 * Set a new password for whoever the current session belongs to.
 *
 * There is no "old password" parameter and there does not need to be: reaching
 * here at all requires the session the recovery link issued, or an already
 * signed-in session. Supabase checks that; this cannot be called for somebody
 * else's account.
 */
export const setNewPassword = async (password: string): Promise<Result<void, AppError>> => {
  const db = await createServerDbClient();

  const { data: identity } = await db.auth.getUser();

  if (!identity.user) {
    return err(AppError.unauthorized("that recovery link has expired. Ask for a new one."));
  }

  const { error } = await db.auth.updateUser({ password });

  if (error) return err(AppError.badRequest(error.message));

  return ok(undefined);
};

export const startGoogleSignIn = async (
  nextPath?: string | null,
): Promise<Result<{ url: string }, AppError>> => {
  const db = await createServerDbClient();

  const callback = new URL("/api/auth/callback", siteUrl());
  if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
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

/**
 * Where to send somebody after the OAuth round trip.
 *
 * Built against `siteUrl()`, never against a request header. The callback used to
 * read `x-forwarded-host`, which the caller supplies, so a request carrying
 * `x-forwarded-host: evil.example` redirected a just-signed-in user there.
 */
export const signedInDestination = async (path: string): Promise<string> => {
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/ask";

  return new URL(safe, siteUrl()).toString();
};
