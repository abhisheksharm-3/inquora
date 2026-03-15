/**
 * Shared utility functions for document processors.
 */

import { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

type RetryableFunction<T> = () => Promise<T>;

export async function withRetry<T>(
    fn: RetryableFunction<T>,
    options: {
        maxRetries?: number;
        initialDelayMs?: number;
        maxDelayMs?: number;
        shouldRetry?: (error: unknown) => boolean;
        onRetry?: (attempt: number, error: unknown) => void;
    } = {}
): Promise<T> {
    const {
        maxRetries = DEFAULT_MAX_RETRIES,
        initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
        maxDelayMs = DEFAULT_MAX_DELAY_MS,
        shouldRetry = () => true,
        onRetry,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
            const jitter = delay * 0.1 * Math.random();

            onRetry?.(attempt + 1, error);
            await sleep(delay + jitter);
        }
    }

    throw lastError;
}

export function isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes("rate limit") ||
            message.includes("429") ||
            message.includes("too many requests") ||
            message.includes("quota exceeded")
        );
    }
    return false;
}

export async function updateFileStatus(
    supabase: SupabaseClient,
    fileId: string,
    status: "pending" | "processing" | "processed" | "error",
    additionalData?: Record<string, unknown>
): Promise<void> {
    const { error } = await supabase
        .from("files")
        .update({ status, ...additionalData })
        .eq("id", fileId);

    if (error) {
        console.error(`Failed to update file status for ${fileId}:`, error);
    }
}

export function createProgressLogger(
    fileId: string,
    onProgress?: (progress: number, message: string) => void
): (progress: number, message: string) => void {
    return (progress: number, message: string) => {
        console.log(`[${fileId}] ${progress}% - ${message}`);
        onProgress?.(progress, message);
    };
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export async function processBatches<T, R>(
    items: T[],
    batchSize: number,
    delayMs: number,
    processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    const batches = chunk(items, batchSize);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchResults = await Promise.all(
            batch.map((item, idx) => processor(item, i * batchSize + idx))
        );
        results.push(...batchResults);

        if (i < batches.length - 1) {
            await sleep(delayMs);
        }
    }

    return results;
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "An unknown error occurred";
}
