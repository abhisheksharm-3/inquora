import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";
import { rateLimiter } from "@/server/platform/ratelimit/redis";

/**
 * The limits on authentication attempts, owned by a module rather than reached
 * for from the action. A server action is transport: it reads a form and returns
 * a message, and the rule about how many times a password may be guessed is not
 * a transport concern.
 */
export const guardSignIn = (email: string): Promise<Result<void, AppError>> =>
  rateLimiter().check("auth", `login:${email}`);

export const guardSignUp = (email: string): Promise<Result<void, AppError>> =>
  rateLimiter().check("auth", `signup:${email}`);
