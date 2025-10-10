/**
 * DocumentProcessingProgress Component
 *
 * Shows real-time progress for document processing operations.
 * Provides visual feedback to users during upload and processing.
 */

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
  Youtube,
  Sparkles,
  Brain,
  Zap,
  MessageSquare,
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

// Educational RAG facts that rotate during processing
const RAG_FACTS = [
  {
    icon: Brain,
    text: "Your document is being analyzed and broken into smaller, searchable chunks",
  },
  {
    icon: Sparkles,
    text: "We're making your content instantly searchable so you get accurate answers",
  },
  {
    icon: Zap,
    text: "Processing your document to enable smart, context-aware conversations",
  },
  {
    icon: MessageSquare,
    text: "Preparing your content for intelligent Q&A with precise citations",
  },
];

const getStatusMessage = (status: string) => {
  switch (status) {
    case "uploading":
      return "Uploading your document...";
    case "processing":
      return "Processing your document";
    case "completed":
      return "Ready to chat!";
    case "failed":
      return "Processing failed";
    default:
      return "Ready to process";
  }
};

export const DocumentProcessingProgress: React.FC<
  DocumentProcessingProgressProps
> = ({
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

  // Rotate RAG facts during processing
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setCurrentFactIndex((prev) => (prev + 1) % RAG_FACTS.length);
      }, 4000); // Change fact every 4 seconds

      return () => clearInterval(interval);
    }
  }, [isActive]);

  const currentFact = RAG_FACTS[currentFactIndex];
  const FactIcon = currentFact.icon;

  // Truncate file name if too long
  const truncateFileName = (name: string, maxLength: number = 35) => {
    if (name.length <= maxLength) return name;
    const extension = name.split(".").pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf("."));
    const truncatedName = nameWithoutExt.substring(0, maxLength - 3 - (extension?.length || 0));
    return `${truncatedName}...${extension ? `.${extension}` : ""}`;
  };

  return (
    <Card className={cn("p-5 space-y-4", className)}>
      {/* Header with file info */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "p-2.5 rounded-lg transition-colors shrink-0",
            isSuccess && "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
            isError && "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
            isActive && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
            !isActive &&
              !isSuccess &&
              !isError &&
              "bg-muted text-muted-foreground",
          )}
        >
          <FileIcon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" title={fileName}>
            {truncateFileName(fileName)}
          </p>
          <p className={cn("text-xs mt-0.5", getStatusColor(status))}>
            {getStatusMessage(status)}
          </p>
        </div>

        {isActive && (
          <div className="shrink-0">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}

        {isSuccess && (
          <div className="shrink-0">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
        )}

        {isError && (
          <div className="shrink-0">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        )}
      </div>

      {/* Single consolidated progress section for active processing */}
      {isActive && (
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-blue-600"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Educational fact about RAG */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg transition-all duration-500">
            <div className="shrink-0 mt-0.5">
              <FactIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              {currentFact.text}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">{Math.round(progress)}% complete</span>
            <span className="text-muted-foreground/70">This may take a moment...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {isError && error && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Processing Failed
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>

          {canRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="w-full gap-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Processing
            </Button>
          )}
        </div>
      )}

      {/* Success Message */}
      {isSuccess && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            Document processed and ready for chat!
          </p>
        </div>
      )}
    </Card>
  );
};
