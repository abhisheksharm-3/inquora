/**
 * The cache is a convenience, never a dependency. Absent Redis means uncached,
 * and a Redis that is down means a miss: the query still gets answered, one
 * embedding call slower. The previous code kept an in-process Map as a
 * "fallback", which on serverless scoped to a single lambda and so cached almost
 * nothing while reading as though it cached everything.
 */

/** The slice of the Upstash client this uses. Narrow on purpose, so it is fakeable. */
export interface RedisLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options: { ex: number }): Promise<unknown>;
}

export interface Cache {
  readonly configured: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

/** Thirty days, per the design. A query embedding does not go stale. */
export const EMBEDDING_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * A cache key for one query embedding. crypto.subtle.digest rather than a hash
 * package: it is in the platform, and the key only has to be stable and short.
 */
export const embeddingKey = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));

  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `embedding:${hex}`;
};

export const createCache = ({ redis }: { redis?: RedisLike }): Cache => ({
  configured: Boolean(redis),

  async get<T>(key: string) {
    if (!redis) return undefined;

    try {
      const value = await redis.get(key);
      return value === null || value === undefined ? undefined : (value as T);
    } catch {
      return undefined;
    }
  },

  async set(key, value, ttlSeconds) {
    if (!redis) return;

    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch {
      // A cache write is not worth failing a request over.
    }
  },
});
