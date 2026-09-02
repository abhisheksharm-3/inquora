import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";

/**
 * The one thing the embeddings client needs from fetch. Narrower than the global
 * type on purpose: the seam stays small, and a test double does not have to
 * implement the runtime's extensions to it.
 */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface EmbeddingsConfig {
  baseUrl: string;
  apiKey: string;
  /** The Space cold-starts, and a cold start has been measured at 18 seconds. */
  timeoutMs?: number;
  fetch?: FetchLike;
}

export interface EmbeddingsClient {
  embed(texts: string[]): Promise<Result<number[][], AppError>>;
}

/** The Space's response shape. */
export interface EmbeddingsResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
}
