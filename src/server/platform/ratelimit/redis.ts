import { Redis } from "@upstash/redis";
import { env } from "@/server/platform/env";
import { createRateLimiter } from "./ratelimit";
import type { RateLimiter } from "./ratelimit.types";

/**
 * The limiter wired to the configured Redis, or a permissive one when none is
 * configured. One place builds it, so no call site has to know whether Upstash
 * is set up.
 */
export const rateLimiter = (): RateLimiter => {
  const configuration = env();

  return createRateLimiter({
    // Unconfigured is an error in production and a no-op in development, so local
    // work needs no Redis and a deployment cannot quietly run without one.
    required: configuration.NODE_ENV === "production",
    redis:
      configuration.UPSTASH_REDIS_REST_URL && configuration.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: configuration.UPSTASH_REDIS_REST_URL,
            token: configuration.UPSTASH_REDIS_REST_TOKEN,
          })
        : undefined,
  });
};
