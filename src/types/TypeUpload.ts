import { RemixiconComponentType } from "@remixicon/react";

export interface TypeFileTypeConfig {
  type: string;
  name: string;
  icon: RemixiconComponentType;
  iconColor?: string;
  accept: string;
  maxSize: number;
  comingSoon?: boolean;
  urlOnly?: boolean;
  statusMessage?: string;
  statusType?: "info" | "warning";
}

export interface TypeFileType {
  data?: {
    type?: string | null;
    name?: string;
  } | null;
}

export interface TypeUploadModalAreaProps {
  fileTypeConfig: TypeFileTypeConfig;
  selectedFile: File | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface TypeUploadModalSuccessProps {
  fileName: string;
  handleRemoveFile: () => void;
}

export interface TypeUploadModalUrlInputProps {
  url: string;
  fileTypeConfig: TypeFileTypeConfig;
  isUrlOnly: boolean;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUrlSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isUploading: boolean;
}

export interface TypeUploadModalErrorProps {
  error: TypeUploadError | string | null | undefined;
  handleRetry: () => void;
  canRetry?: boolean;
  isRetrying?: boolean;
  retryCount?: number;
  onContactSupport?: () => void;
  onDismiss?: () => void;
}

export interface TypeUploadModalProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  fileType: string;
}

export interface TypeUseUploadLogicProps {
  fileType: string;
  onClose: () => void;
}

export type TypeUploadStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "uploaded"
  | "error";

export interface TypeUploadState {
  uploadStatus: TypeUploadStatus;
  fileName: string;
  url: string;
  error: TypeUploadError | null;
  selectedFile: File | null;
  retryCount: number;
  isRetrying: boolean;
}

// Enhanced error types for better error categorization
export interface TypeUploadError {
  type:
    | "validation"
    | "network"
    | "server"
    | "auth"
    | "file_processing"
    | "chat_creation"
    | "unknown";
  message: string;
  originalError?: unknown;
  retryable?: boolean;
  userAction?: string;
}

export interface TypeDetailUploadErrorField {
  key: string;
  label: string;
  getValue: (error: TypeUploadError, retryCount?: number) => unknown;
  condition?: (error: TypeUploadError, retryCount?: number) => boolean;
  isCodeBlock?: boolean;
  className?: string;
}
