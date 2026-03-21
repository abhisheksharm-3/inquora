/**
 * DocumentProcessor Service
 *
 * Centralized service for handling document processing operations.
 * Provides a clean interface for processing different types of documents
 * with proper error handling, status tracking, and retry mechanisms.
 */

import { TypeFile } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "@/data/supabase/client";
import {
  processYoutubeVideo,
  processGitHubRepository,
  processWebPage,
  processPdfDocument,
  processGenericDocument,
  checkNamespaceExists,
} from "@/utils/processors";
import {
  ProcessingProgress,
  ProcessingResult,
  ProcessingStatus,
} from "@/types/document-processor";
export class DocumentProcessor {
  private supabase: SupabaseClient;
  private progressCallbacks: Map<
    string,
    (progress: ProcessingProgress) => void
  > = new Map();

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || supabaseBrowserClient();
  }

  /**
   * Register a callback to receive processing progress updates
   */
  onProgress(
    fileId: string,
    callback: (progress: ProcessingProgress) => void,
  ): void {
    this.progressCallbacks.set(fileId, callback);
  }

  /**
   * Unregister a progress callback
   */
  offProgress(fileId: string): void {
    this.progressCallbacks.delete(fileId);
  }

  /**
   * Emit progress update to registered callback
   */
  private emitProgress(progress: ProcessingProgress): void {
    const callback = this.progressCallbacks.get(progress.fileId);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Starts an interval that gradually increments emitted progress from `start` to `end`
   * over approximately `durationMs` milliseconds. Returns a stop function that clears
   * the interval and emits a final snapshot at `end`.
   */
  private startProgressAnimation(
    fileId: string,
    start: number,
    end: number,
    durationMs: number,
  ): () => void {
    const STEPS = 25;
    const intervalMs = durationMs / STEPS;
    const increment = (end - start) / STEPS;
    let current = start;

    const id = setInterval(() => {
      current = Math.min(current + increment, end);
      this.emitProgress({ fileId, status: "processing", progress: Math.round(current) });
      if (current >= end) clearInterval(id);
    }, intervalMs);

    return () => {
      clearInterval(id);
      this.emitProgress({ fileId, status: "processing", progress: end });
    };
  }

  /**
   * Update file processing status in database
   */
  private async updateFileStatus(
    fileId: string,
    status: ProcessingStatus,
    details: { error?: string; indexedChunks?: number } = {},
  ): Promise<void> {
    const updateData: {
      processing_status: ProcessingStatus;
      processing_error: string | null;
      indexed_chunks?: number;
    } = {
      processing_status: status,
      processing_error: details.error || null,
    };

    if (details.indexedChunks !== undefined) {
      updateData.indexed_chunks = details.indexedChunks;
    }

    const { error } = await this.supabase
      .from("files")
      .update(updateData)
      .eq("id", fileId);

    if (error) {
      console.error("Failed to update file status:", error);
    }
  }

  /**
   * Get file blob from Supabase storage
   */
  private async getFileBlob(file: TypeFile): Promise<Blob | null> {
    if (!file.url) {
      console.error("Cannot get file blob without a file URL.", file);
      return null;
    }

    const STORAGE_BUCKET = "file-storage";
    let path: string;

    try {
      path = new URL(file.url).pathname.split(`/${STORAGE_BUCKET}/`)[1];
      if (!path) throw new Error("Path extraction from URL failed.");
    } catch (e) {
      console.error(`Could not parse storage path from URL: ${file.url}`, e);
      return null;
    }

    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .download(path);

    if (error) {
      console.error(
        `Failed to download blob from path: ${path}`,
        error.message,
      );
      return null;
    }

    return data;
  }

  /**
   * Check if document is already processed
   */
  async isProcessed(fileId: string): Promise<boolean> {
    try {
      // First check database status
      const { data: file, error } = await this.supabase
        .from("files")
        .select("processing_status")
        .eq("id", fileId)
        .single();

      if (error || !file) {
        return false;
      }

      if (file.processing_status === "completed") {
        return true;
      }

      // Also check if namespace exists in vector store
      return await checkNamespaceExists(fileId);
    } catch (error) {
      console.error("Error checking processing status:", error);
      return false;
    }
  }

  /**
   * Process a document based on its type
   */
  async processDocument(file: TypeFile): Promise<ProcessingResult> {
    const { id: fileId, type, url } = file;

    // Emit initial progress
    this.emitProgress({
      fileId,
      status: "processing",
      progress: 0,
    });

    try {
      // Check if already processed
      if (await this.isProcessed(fileId)) {
        const result: ProcessingResult = {
          success: true,
          status: "completed",
        };

        this.emitProgress({
          fileId,
          status: "completed",
          progress: 100,
        });

        return result;
      }

      // Update status to processing
      await this.updateFileStatus(fileId, "processing");

      let processingResult: {
        success: boolean;
        error?: string;
        numDocs?: number;
      };

      let stopAnimation: (() => void) | null = null;

      switch (type) {
        case "youtube":
        case "video":
          if (!url) throw new Error("YouTube URL is required");
          stopAnimation = this.startProgressAnimation(fileId, 10, 72, 45000);
          processingResult = await processYoutubeVideo(url, fileId);
          break;

        case "github":
          if (!url) throw new Error("GitHub URL is required");
          stopAnimation = this.startProgressAnimation(fileId, 10, 72, 60000);
          processingResult = await processGitHubRepository(url, fileId);
          break;

        case "web":
          if (!url) throw new Error("Web URL is required");
          stopAnimation = this.startProgressAnimation(fileId, 10, 72, 30000);
          processingResult = await processWebPage(url, fileId);
          break;

        case "pdf":
          stopAnimation = this.startProgressAnimation(fileId, 10, 72, 20000);
          const pdfBlob = await this.getFileBlob(file);
          if (!pdfBlob) throw new Error("Could not read PDF file from storage");
          processingResult = await processPdfDocument(pdfBlob, fileId);
          break;

        case "doc":
        case "docs":
        case "sheet":
        case "sheets":
        case "slides":
          stopAnimation = this.startProgressAnimation(fileId, 10, 72, 25000);
          const docBlob = await this.getFileBlob(file);
          if (!docBlob)
            throw new Error(`Could not read ${type} file from storage`);
          processingResult = await processGenericDocument(
            docBlob,
            fileId,
            type,
          );
          break;

        case "image": {
          const result: ProcessingResult = {
            success: true,
            status: "completed",
          };

          await this.updateFileStatus(fileId, "completed");
          this.emitProgress({
            fileId,
            status: "completed",
            progress: 100,
          });

          return result;
        }

        default:
          throw new Error(`Unsupported file type: ${type}`);
      }

      stopAnimation?.();
      this.emitProgress({ fileId, status: "processing", progress: 80 });

      if (!processingResult.success) {
        throw new Error(processingResult.error || "Processing failed");
      }

      // Update status to completed
      await this.updateFileStatus(fileId, "completed", {
        indexedChunks: processingResult.numDocs,
      });

      const finalResult: ProcessingResult = {
        success: true,
        status: "completed",
        numDocs: processingResult.numDocs,
      };

      this.emitProgress({
        fileId,
        status: "completed",
        progress: 100,
        numDocs: processingResult.numDocs,
      });

      return finalResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Update status to failed
      await this.updateFileStatus(fileId, "failed", { error: errorMessage });

      const failedResult: ProcessingResult = {
        success: false,
        status: "failed",
        error: errorMessage,
      };

      this.emitProgress({
        fileId,
        status: "failed",
        error: errorMessage,
      });

      return failedResult;
    }
  }

  /**
   * Process multiple documents in parallel with concurrency control
   */
  async processDocuments(
    files: TypeFile[],
    concurrency: number = 3,
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    // Process files in batches to control concurrency
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((file) => this.processDocument(file)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Retry processing for a failed document
   */
  async retryProcessing(file: TypeFile): Promise<ProcessingResult> {
    // Reset the processing status
    await this.updateFileStatus(file.id, "idle");

    // Process again
    return this.processDocument(file);
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();
