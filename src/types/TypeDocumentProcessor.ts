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