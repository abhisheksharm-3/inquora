/**
 * DocumentProcessingProgress Component
 * 
 * Shows real-time progress for document processing operations.
 * Provides visual feedback to users during upload and processing.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  FileText,
  Globe,
  Github,
  Youtube
} from "lucide-react";
import { cn } from "@/utils/cn";

interface DocumentProcessingProgressProps {
  fileName: string;
  fileType: string;
  status: "idle" | "uploading" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string | null;
  onRetry?: () => void;
  canRetry?: boolean;
  className?: string;
}

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "youtube":
    case "video":
      return Youtube;
    case "github":
      return Github;
    case "web":
      return Globe;
    default:
      return FileText;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "text-green-600";
    case "failed":
      return "text-red-600";
    case "processing":
    case "uploading":
      return "text-blue-600";
    default:
      return "text-muted-foreground";
  }
};

const getStatusMessage = (status: string, fileType: string) => {
  switch (status) {
    case "uploading":
      return "Uploading file...";
    case "processing":
      switch (fileType) {
        case "youtube":
        case "video":
          return "Extracting transcript and creating embeddings...";
        case "github":
          return "Analyzing repository structure and content...";
        case "web":
          return "Scraping content and creating embeddings...";
        case "pdf":
          return "Extracting text and creating embeddings...";
        default:
          return "Processing document and creating embeddings...";
      }
    case "completed":
      return "Document processed successfully!";
    case "failed":
      return "Processing failed";
    default:
      return "Ready to process";
  }
};

export const DocumentProcessingProgress: React.FC<DocumentProcessingProgressProps> = ({
  fileName,
  fileType,
  status,
  progress = 0,
  error,
  onRetry,
  canRetry,
  className,
}) => {
  const FileIcon = getFileIcon(fileType);
  const isActive = status === "uploading" || status === "processing";
  const isSuccess = status === "completed";
  const isError = status === "failed";

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isSuccess && "bg-green-100 text-green-600",
          isError && "bg-red-100 text-red-600",
          isActive && "bg-blue-100 text-blue-600",
          !isActive && !isSuccess && !isError && "bg-muted text-muted-foreground"
        )}>
          <FileIcon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{fileName}</p>
          <p className={cn("text-xs", getStatusColor(status))}>
            {getStatusMessage(status, fileType)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          )}
          
          {isSuccess && (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          
          {isError && (
            <XCircle className="h-4 w-4 text-red-600" />
          )}

          <Badge 
            variant={isSuccess ? "default" : isError ? "destructive" : "secondary"}
            className="text-xs"
          >
            {status === "uploading" && "Uploading"}
            {status === "processing" && "Processing"}
            {status === "completed" && "Complete"}
            {status === "failed" && "Failed"}
            {status === "idle" && "Ready"}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      {(isActive || isSuccess) && (
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                isSuccess ? "bg-green-600" : "bg-blue-600"
              )}
              style={{ width: `${isSuccess ? 100 : progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{isSuccess ? "Processing complete" : `${Math.round(progress)}%`}</span>
            {isActive && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Please wait...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {isError && error && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">Processing Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          
          {canRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="w-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Processing
            </Button>
          )}
        </div>
      )}

      {/* Success Message */}
      {isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-800">
            Document processed and ready for chat!
          </p>
        </div>
      )}
    </Card>
  );
};
