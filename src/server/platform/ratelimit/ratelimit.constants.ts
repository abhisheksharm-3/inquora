import type { Bucket } from "./ratelimit.types";

/**
 * Requests allowed per window, per user, per bucket.
 *
 * Auth is tighter and over a longer window than the others, because it guards a
 * password against being guessed rather than a budget against being spent.
 * Messages is the one that protects the bill: each costs at least one model turn.
 */
export const LIMITS: Record<Bucket, { limit: number; windowSeconds: number }> = {
  messages: { limit: 30, windowSeconds: 60 },
  ingestion: { limit: 20, windowSeconds: 60 },
  uploads: { limit: 20, windowSeconds: 60 },
  auth: { limit: 10, windowSeconds: 300 },
};
