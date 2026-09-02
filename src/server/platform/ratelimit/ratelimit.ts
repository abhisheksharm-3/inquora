import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import { LIMITS } from "./ratelimit.constants";
import type { RateLimiter, RateLimitRedis } from "./ratelimit.types";

/**
 * One rate limiter, with a bucket per kind of work. The old code had two
 * implementations, one of them an in-process Map that on serverless scoped to a
 * single lambda and so limited almost nothing.
 *
 * A fixed window in one Redis round trip. Not a sliding window: the extra
 * precision buys nothing here, and the simplest correct thing is the one that
 * stays correct.
 */

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

export const createRateLimiter = ({ redis }: { redis?: RateLimitRedis }): RateLimiter => ({
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
