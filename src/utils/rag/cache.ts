import { env } from "@/config/env";
import type { TypeQueryAnalysis } from "@/types/rag";

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const DEFAULT_TTL_MS = Number(env.RAG_CACHE_TTL) || 5 * 60 * 1000; // 5 minutes default
const MAX_CACHE_SIZE = Number(env.RAG_CACHE_SIZE) || 100;

class QueryCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private ttlMs: number;
    private maxSize: number;

    constructor(ttlMs = DEFAULT_TTL_MS, maxSize = MAX_CACHE_SIZE) {
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    set(key: string, value: T): void {
        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs,
        });
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

/**
 * Generate a cache key from query and namespace.
 */
function generateCacheKey(query: string, namespace?: string): string {
    const normalizedQuery = query.toLowerCase().trim();
    return `${namespace || "default"}:${normalizedQuery}`;
}

export const queryAnalysisCache = new QueryCache<TypeQueryAnalysis>(DEFAULT_TTL_MS);
export const retrievalCache = new QueryCache<unknown>(DEFAULT_TTL_MS);

/**
 * Wrapper for caching async operations.
 */
export async function withCache<T>(
    cache: QueryCache<T>,
    key: string,
    fn: () => Promise<T>
): Promise<T> {
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const result = await fn();
    cache.set(key, result);
    return result;
}

export { QueryCache, generateCacheKey, DEFAULT_TTL_MS };
