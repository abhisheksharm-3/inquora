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

export const createRateLimiter = ({
  redis,
  required = false,
}: {
  redis?: RateLimitRedis;
  /**
   * Whether an unconfigured limiter is an error rather than a no-op. True in
   * production: failing open on a Redis outage is a considered tradeoff, failing
   * open because nobody set the variables is a limiter that was never there.
   * Those two were indistinguishable at runtime, and this is the one endpoint
   * whose only guard is this.
   */
  required?: boolean;
}): RateLimiter => ({
  configured: Boolean(redis),

  async check(bucket, userId) {
    if (!redis) {
      if (required) {
        return err(
          AppError.misconfigured(
            "no rate limiter is configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
          ),
        );
      }

      return ok(undefined);
    }

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
      // The window is stated rather than assumed: the auth bucket is five
      // minutes, and a 429 that says "a minute" beside Retry-After: 287 is a lie.
      const window =
        windowSeconds === 60 ? "a minute" : `${Math.round(windowSeconds / 60)} minutes`;

      return err(AppError.rateLimited(retryAfter, `at most ${limit} ${bucket} requests ${window}`));
    }

    return ok(undefined);
  },
});
