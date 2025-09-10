"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Github,
  Star,
  GitFork,
  Calendar,
  FileCode,
  Loader2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useGitHub } from "@/hooks/useGitHub";
import { cn } from "@/utils/cn";

interface GitHubUploadProps {
  onSuccess?: (repositoryId: string) => void;
  onError?: (error: string) => void;
  className?: string;
  autoFocus?: boolean;
}

const GitHubUpload = ({
  onSuccess,
  onError,
  className,
  autoFocus = false,
}: GitHubUploadProps) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    repositoryUrl,
    setRepositoryUrl,
    isValidUrl,
    validationError,
    repositoryPreview,
    isValidating,
    isLoadingPreview,
    uploadRepository,
    isUploading,
    uploadError,
    clearState,
  } = useGitHub({
    enablePreview: true,
    autoValidate: true,
  });

  // Simulate upload progress for better UX
  const simulateProgress = useCallback(() => {
    if (!isUploading) return;

    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 20;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isUploading]);

  const handleUpload = useCallback(async () => {
    try {
      simulateProgress();
      const uploadedFile = await uploadRepository();
      setUploadProgress(100);

      setTimeout(() => {
        onSuccess?.(uploadedFile.id);
        clearState();
        setUploadProgress(0);
      }, 500);
    } catch (error) {
      setUploadProgress(0);
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      onError?.(errorMessage);
    }
  }, [uploadRepository, onSuccess, onError, clearState, simulateProgress]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && isValidUrl && !isUploading) {
        e.preventDefault();
        handleUpload();
      }
    },
    [isValidUrl, isUploading, handleUpload],
  );

  const handleClear = useCallback(() => {
    clearState();
    setUploadProgress(0);
    inputRef.current?.focus();
  }, [clearState]);

  const getInputStatus = () => {
    if (isValidating || isLoadingPreview) return "loading";
    if (validationError) return "error";
    if (isValidUrl) return "success";
    return "default";
  };

  const getInputIcon = () => {
    const status = getInputStatus();
    const iconClass = "h-4 w-4";

    switch (status) {
      case "loading":
        return (
          <Loader2 className={cn(iconClass, "animate-spin text-primary")} />
        );
      case "error":
        return <AlertCircle className={cn(iconClass, "text-destructive")} />;
      case "success":
        return <CheckCircle2 className={cn(iconClass, "text-green-500")} />;
      default:
        return <Github className={cn(iconClass, "text-muted-foreground")} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* URL Input */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
            {getInputIcon()}
          </div>
          <Input
            ref={inputRef}
            type="url"
            placeholder="https://github.com/owner/repository"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "pl-10 pr-4",
              validationError &&
                "border-destructive focus-visible:ring-destructive",
              isValidUrl && "border-green-500 focus-visible:ring-green-500",
            )}
            disabled={isUploading}
            autoFocus={autoFocus}
          />
          {repositoryUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
              disabled={isUploading}
            >
              ×
            </Button>
          )}
        </div>

        {/* Error Message */}
        {validationError && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validationError}
          </p>
        )}

        {/* Upload Error */}
        {uploadError && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {uploadError instanceof Error
              ? uploadError.message
              : "Upload failed"}
          </p>
        )}
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Processing repository...
            </span>
            <span className="text-muted-foreground">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Repository Preview */}
      {repositoryPreview && !isUploading && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  {repositoryPreview.fullName}
                </CardTitle>
                {repositoryPreview.description && (
                  <CardDescription className="text-sm">
                    {repositoryPreview.description}
                  </CardDescription>
                )}
              </div>
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Repository Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {repositoryPreview.language && (
                <div className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  <span>{repositoryPreview.language}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                <span>{formatNumber(repositoryPreview.stars)}</span>
              </div>
              <div className="flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                <span>{formatNumber(repositoryPreview.forks)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Updated {formatDate(repositoryPreview.lastUpdate)}</span>
              </div>
            </div>

            <Separator />

            {/* Upload Action */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Ready to analyze repository content
              </div>
              <Button
                onClick={handleUpload}
                disabled={isUploading || !isValidUrl}
                size="sm"
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Helper Text */}
      {!repositoryUrl && !isUploading && (
        <div className="text-center text-sm text-muted-foreground">
          Enter a GitHub repository URL to analyze its codebase and
          documentation
        </div>
      )}
    </div>
  );
};

export default GitHubUpload;
