/**
 * Rate limiting for API routes and server actions.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 * Falls back to in-memory storage when Redis is not configured (not shared across serverless invocations).
 */

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokens: 10,
  refillRate: 1,
  windowMs: 60 * 1000,
};

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupMemoryStore(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  const cutoff = now - windowMs * 2;
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.lastRefill < cutoff) memoryStore.delete(key);
  }
  lastCleanup = now;
}

async function checkRateLimitUpstash(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const limit = config.maxTokens;
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
  });

  const { success, remaining, reset } = await ratelimit.limit(identifier);
  return {
    allowed: success,
    remaining,
    resetMs: Math.max(0, reset - Date.now()),
  };
}

function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetMs: number } {
  const { maxTokens, refillRate, windowMs } = config;
  const now = Date.now();

  cleanupMemoryStore(windowMs);

  let entry = memoryStore.get(identifier);
  if (!entry) {
    entry = { tokens: maxTokens - 1, lastRefill: now };
    memoryStore.set(identifier, entry);
    return { allowed: true, remaining: entry.tokens, resetMs: windowMs };
  }

  const elapsed = now - entry.lastRefill;
  const refillTokens = Math.floor((elapsed / 1000) * refillRate);
  if (refillTokens > 0) {
    entry.tokens = Math.min(maxTokens, entry.tokens + refillTokens);
    entry.lastRefill = now;
  }

  if (entry.tokens > 0) {
    entry.tokens--;
    return { allowed: true, remaining: entry.tokens, resetMs: windowMs - elapsed };
  }

  const resetMs = Math.ceil((1 / refillRate) * 1000);
  return { allowed: false, remaining: 0, resetMs };
}

function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {},
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const merged = { ...DEFAULT_CONFIG, ...config };

  if (isUpstashConfigured()) {
    return checkRateLimitUpstash(identifier, merged);
  }
  return Promise.resolve(checkRateLimitMemory(identifier, merged));
}

export const RATE_LIMIT_CONFIGS = {
  auth: {
    maxTokens: 5,
    refillRate: 0.1,
    windowMs: 60 * 1000,
  },
  signup: {
    maxTokens: 3,
    refillRate: 0.05,
    windowMs: 60 * 1000,
  },
  passwordReset: {
    maxTokens: 3,
    refillRate: 0.033,
    windowMs: 60 * 1000,
  },
  api: {
    maxTokens: 60,
    refillRate: 1,
    windowMs: 60 * 1000,
  },
} as const;

export function createRateLimitResponse(resetMs: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      message: "Please wait before trying again.",
      retryAfter: Math.ceil(resetMs / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetMs / 1000)),
      },
    },
  );
}
