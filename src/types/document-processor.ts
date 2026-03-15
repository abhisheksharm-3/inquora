export type ProcessingStatus = "idle" | "processing" | "completed" | "failed";

export interface ProcessingResult {
  success: boolean;
  error?: string;
  numDocs?: number;
  status: ProcessingStatus;
}

export interface ProcessingProgress {
  fileId: string;
  status: ProcessingStatus;
  progress?: number;
  error?: string;
  numDocs?: number;
}

/**
 * Shared result type for all document processors.
 */
export interface DocumentProcessResult {
  success: boolean;
  fileId: string;
  documentCount?: number;
  chunkCount?: number;
  processingTimeMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for document processing.
 */
export interface ProcessorConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  maxRetries?: number;
  batchSize?: number;
  delayBetweenBatchesMs?: number;
}

/**
 * Callback for progress updates during processing.
 */
export type ProgressCallback = (progress: number, message: string) => void;
