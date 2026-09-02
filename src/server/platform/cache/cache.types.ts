/** The slice of the Upstash client the cache uses. Narrow on purpose, so it is fakeable. */
export interface RedisLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options: { ex: number }): Promise<unknown>;
}

export interface Cache {
  readonly configured: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}
