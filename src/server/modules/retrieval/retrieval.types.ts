import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";
import type { Cache } from "@/server/platform/cache/cache.types";

export type { RetrievalRequest, RetrievedChunk } from "./retrieval.schema";

import type { RetrievalRequest, RetrievedChunk } from "./retrieval.schema";

export interface SearchArgs {
  documentIds: string[];
  embedding: number[];
  query: string;
  limit: number;
}

export interface RetrievalRepository {
  search(args: SearchArgs): Promise<Result<RetrievedChunk[], AppError>>;
}

export interface ChunksRepository {
  range(args: {
    documentId: string;
    from: number;
    to: number;
  }): Promise<Result<RetrievedChunk[], AppError>>;
}

export interface RetrievalService {
  retrieve(request: RetrievalRequest): Promise<Result<RetrievedChunk[], AppError>>;
}

export interface RetrievalDependencies {
  embeddings: { embed(texts: string[]): Promise<Result<number[][], AppError>> };
  repository: RetrievalRepository;
  cache: Cache;
}
