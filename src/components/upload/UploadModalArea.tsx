"use client";

import { getFileTypeConfig } from "@/constants/file-types";
import { cn } from "@/utils/cn";
import type { getFileTypeConfig as GetFileTypeConfigType } from "@/constants/file-types";
import { Upload, X, FileIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Renders an enhanced drag-and-drop area for file uploads within the upload modal.
 *
 * Features:
 * - Smooth drag-and-drop with visual feedback
 * - File preview with size information
 * - Clear file removal option
 * - Better visual hierarchy and spacing
 * - Improved error messaging
 * - File type validation feedback
 *
 * @param {object} props - The component props.
 * @param {object} props.fileTypeConfig - Configuration for the accepted file type.
 * @param {File | null} props.selectedFile - The currently selected file.
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} props.handleFileChange - Callback for file selection.
 * @returns {JSX.Element} The rendered upload area component.
 */
const UploadModalArea: React.FC<{
  fileTypeConfig: Awaited<ReturnType<typeof getFileTypeConfig>>;
  selectedFile: File | null;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
}> = ({ fileTypeConfig, selectedFile, handleFileChange, handleRemoveFile }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const maxSizeMB = Math.round(fileTypeConfig.maxSize / (1024 * 1024));
  const fileSizeMB = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : "0";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    setDragError(null);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > fileTypeConfig.maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit`,
      };
    }
    return { valid: true };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validation = validateFile(file);

      if (!validation.valid) {
        setDragError(validation.error || "Invalid file");
        return;
      }

      setDragError(null);
      const syntheticEvent = {
        target: { files },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(syntheticEvent);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validation = validateFile(file);

      if (!validation.valid) {
        setDragError(validation.error || "Invalid file");
        return;
      }

      setDragError(null);
      handleFileChange(e);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleRemoveFile();
    setDragError(null);
  };

  return (
    <div className="space-y-4">
      {/* Main upload area */}
      <label
        htmlFor="file-upload"
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer block",
          isDragOver
            ? "border-primary bg-primary/10 scale-[1.02] shadow-lg"
            : selectedFile
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40 hover:shadow-md",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="sr-only"
          onChange={handleInputChange}
          accept={fileTypeConfig.accept}
        />

        {!selectedFile ? (
          <div className="space-y-4 text-center">
            {/* Icon */}
            <div className="flex justify-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                  isDragOver ? "bg-primary/30 scale-110" : "bg-primary/10",
                )}
              >
                <Upload
                  className={cn(
                    "h-8 w-8 transition-all duration-200",
                    isDragOver ? "text-primary scale-125" : "text-primary/70",
                  )}
                />
              </div>
            </div>

            {/* Text content */}
            <div className="space-y-2">
              <p className="text-base font-semibold text-foreground">
                {isDragOver ? "Drop your file here" : "Upload your file here"}
              </p>
              <p className="text-sm text-muted-foreground">Click to browse or drag and drop</p>
            </div>

            {/* File requirements */}
            <div className="flex flex-wrap gap-2 justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border border-muted-foreground/20">
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{fileTypeConfig.name}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border border-muted-foreground/20">
                <span className="text-xs text-muted-foreground">Max {maxSizeMB}MB</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">File selected</p>
              <p className="text-sm text-muted-foreground">Ready to upload</p>
            </div>
          </div>
        )}
      </label>

      {/* Selected file details */}
      {selectedFile && (
        <div className="p-4 bg-muted/30 rounded-lg border border-primary/20 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{fileSizeMB} MB</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClearFile}
              className="h-8 w-8 rounded-lg flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* File size warning if close to limit */}
          {parseFloat(fileSizeMB) > maxSizeMB * 0.8 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                File is close to size limit
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {dragError && (
        <div className="p-4 bg-destructive/5 border border-destructive/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-destructive/80 mt-0.5">{dragError}</p>
          </div>
        </div>
      )}

      {/* Additional info */}
      <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-2">
        <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">i</span>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Your file will be securely processed and stored for analysis.
        </p>
      </div>
    </div>
  );
};

export default UploadModalArea;
