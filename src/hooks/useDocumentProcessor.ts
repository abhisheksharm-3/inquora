/**
 * useDocumentProcessor Hook
 * 
 * React hook for managing document processing operations.
 * Provides a clean interface for processing documents with
 * real-time progress updates and error handling.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { documentProcessor } from "@/services/DocumentProcessor";
import { TypeFile } from "@/types/TypeSupabase";
import { ProcessingProgress, ProcessingResult } from "@/types/TypeDocumentProcessor";

export interface UseDocumentProcessorState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  result: ProcessingResult | null;
  status: "idle" | "processing" | "completed" | "failed";
}

export interface UseDocumentProcessorReturn extends UseDocumentProcessorState {
  processDocument: (file: TypeFile) => Promise<ProcessingResult>;
  retryProcessing: (file: TypeFile) => Promise<ProcessingResult>;
  reset: () => void;
  isProcessed: (fileId: string) => Promise<boolean>;
}

export const useDocumentProcessor = (): UseDocumentProcessorReturn => {
  const [state, setState] = useState<UseDocumentProcessorState>({
    isProcessing: false,
    progress: 0,
    error: null,
    result: null,
    status: "idle",
  });

  const currentFileId = useRef<string | null>(null);

  // Progress callback handler
  const handleProgress = useCallback((progress: ProcessingProgress) => {
    // Only update if this is for the current file being processed
    if (currentFileId.current === progress.fileId) {
      setState(prev => ({
        ...prev,
        isProcessing: progress.status === "processing",
        progress: progress.progress || prev.progress,
        error: progress.error || null,
        status: progress.status,
      }));
    }
  }, []);

  // Process a document
  const processDocument = useCallback(async (file: TypeFile): Promise<ProcessingResult> => {
    currentFileId.current = file.id;

    setState({
      isProcessing: true,
      progress: 0,
      error: null,
      result: null,
      status: "processing",
    });

    try {
      // Register progress callback
      documentProcessor.onProgress(file.id, handleProgress);

      const result = await documentProcessor.processDocument(file);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        result,
        status: result.status,
        progress: 100,
        error: result.error || null,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
        status: "failed",
      }));

      return {
        success: false,
        error: errorMessage,
        status: "failed",
      };
    } finally {
      // Cleanup progress callback
      documentProcessor.offProgress(file.id);
      currentFileId.current = null;
    }
  }, [handleProgress]);

  // Retry processing for a failed document
  const retryProcessing = useCallback(async (file: TypeFile): Promise<ProcessingResult> => {
    return processDocument(file);
  }, [processDocument]);

  // Reset the state
  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      error: null,
      result: null,
      status: "idle",
    });
    currentFileId.current = null;
  }, []);

  // Check if document is already processed
  const isProcessed = useCallback(async (fileId: string): Promise<boolean> => {
    return documentProcessor.isProcessed(fileId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentFileId.current) {
        documentProcessor.offProgress(currentFileId.current);
      }
    };
  }, []);

  return {
    ...state,
    processDocument,
    retryProcessing,
    reset,
    isProcessed,
  };
};
