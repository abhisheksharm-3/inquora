import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

/**
 * One rate limiter, with a bucket per kind of work. The old code had two
 * implementations, one of them an in-process Map that on serverless scoped to a
 * single lambda and so limited almost nothing.
 *
 * A fixed window in one Redis round trip. Not a sliding window: the extra
 * precision buys nothing here, and the simplest correct thing is the one that
 * stays correct.
 */

export type Bucket = "messages" | "ingestion" | "uploads";

/** Requests allowed per window, per user, per bucket. */
const LIMITS: Record<Bucket, { limit: number; windowSeconds: number }> = {
  // Each message costs at least one model turn, so this is the expensive one.
  messages: { limit: 30, windowSeconds: 60 },
  ingestion: { limit: 20, windowSeconds: 60 },
  uploads: { limit: 20, windowSeconds: 60 },
};

/**
 * INCR then EXPIRE on first write, as one script so the two cannot be separated
 * by a crash and leave a key that never expires.
 */
const SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

interface RedisLike {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
}

export interface RateLimiter {
  readonly configured: boolean;
  check(bucket: Bucket, userId: string): Promise<Result<void, AppError>>;
}

export const createRateLimiter = ({ redis }: { redis?: RedisLike }): RateLimiter => ({
  configured: Boolean(redis),

  async check(bucket, userId) {
    if (!redis) return ok(undefined);

    const { limit, windowSeconds } = LIMITS[bucket];
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:${bucket}:${userId}:${window}`;

    let current: number;

    try {
      const raw = await redis.eval(SCRIPT, [key], [windowSeconds]);
      current = Array.isArray(raw) ? Number(raw[0]) : Number(raw);
    } catch {
      // A limiter that fails closed turns a Redis outage into a total outage.
      return ok(undefined);
    }

    if (current > limit) {
      const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
      return err(AppError.rateLimited(retryAfter, `at most ${limit} ${bucket} requests a minute`));
    }

    return ok(undefined);
  },
});
