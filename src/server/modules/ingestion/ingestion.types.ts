import type { Chunk } from "@/core/chunking.types";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";

export interface ClaimedJob {
  jobId: number;
  documentId: string;
  attempts: number;
}

export interface IngestionQueue {
  claim(): Promise<Result<ClaimedJob | undefined, AppError>>;
  complete(jobId: number): Promise<Result<void, AppError>>;
  fail(jobId: number, error: string): Promise<Result<void, AppError>>;
  /** The highest chunk_index already stored for a document, or -1 for none. */
  highWaterMark(documentId: string): Promise<Result<number, AppError>>;
}

export interface ChunkStore {
  setExpectedChunks(documentId: string, expected: number): Promise<Result<void, AppError>>;
  insertChunks(
    documentId: string,
    chunks: { chunk_index: number; content: string; embedding: number[]; metadata: unknown }[],
  ): Promise<Result<number, AppError>>;
}

export interface WorkerDependencies {
  queue: IngestionQueue;
  /** Fetch and chunk one document. Everything provider-shaped lives behind this. */
  extract(job: ClaimedJob): Promise<Result<{ chunks: Chunk[]; expectedChunks: number }, AppError>>;
  embeddings: { embed(texts: string[]): Promise<Result<number[][], AppError>> };
  store: ChunkStore;
  /** Chunks per embedding call. The Space takes an array. */
  batchSize?: number;
}

export interface IngestionWorker {
  runOnce(): Promise<Result<"idle" | "processed" | "failed", AppError>>;
}

export interface DrainSummary {
  processed: number;
  failed: number;
  idle: boolean;
}

/** What extraction produces, before chunking chooses a strategy for it. */
export interface Source {
  kind: "pdf" | "doc" | "sheet" | "slides" | "image" | "video" | "github" | "web";
  /** Extracted text, for anything that reduces to prose. */
  text?: string;
  sheets?: { name: string; header: string[]; rows: string[][] }[];
  transcript?: { start: number; text: string }[];
}
