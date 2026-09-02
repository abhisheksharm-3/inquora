import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";

export type Bucket = "messages" | "ingestion" | "uploads" | "auth";

export interface RateLimitRedis {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
}

export interface RateLimiter {
  readonly configured: boolean;
  check(bucket: Bucket, userId: string): Promise<Result<void, AppError>>;
}
