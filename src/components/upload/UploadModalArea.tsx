"use client";

import { getFileTypeConfig } from "@/constants/FileTypes";
import { cn } from "@/utils/cn";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

/**
 * Renders the drag-and-drop area for file uploads within the upload modal.
 *
 * It handles drag events to provide visual feedback and allows users to either
 * drop a file or click to open the native file selector. It also displays
 * information about the selected file.
 *
 * @param {object} props - The component props.
 * @param {ReturnType<typeof getFileTypeConfig>} props.fileTypeConfig - Configuration for the accepted file type.
 * @param {File | null} props.selectedFile - The currently selected file.
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} props.handleFileChange - Callback for file selection.
 * @returns {JSX.Element} The rendered upload area component.
 */
const UploadModalArea: React.FC<{
  fileTypeConfig: ReturnType<typeof getFileTypeConfig>;
  selectedFile: File | null;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ fileTypeConfig, selectedFile, handleFileChange }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const syntheticEvent = {
        target: { files },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(syntheticEvent);
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer group",
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        selectedFile && "border-primary bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById("file-upload")?.click()}
    >
      <label htmlFor="file-upload" className="cursor-pointer block space-y-3">
        <input
          type="file"
          id="file-upload"
          className="sr-only"
          onChange={handleFileChange}
          accept={fileTypeConfig.accept}
        />

        <div className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <CircleAlert className="h-6 w-6 text-primary" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              <span className="text-primary group-hover:text-primary/90 transition-colors">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              {fileTypeConfig.name} (max.{" "}
              {Math.round(fileTypeConfig.maxSize / (1024 * 1024))}MB)
            </p>
          </div>
        </div>
      </label>

      {selectedFile && (
        <div className="mt-4 p-3 bg-muted/50 rounded-md border">
          <p className="text-sm font-medium text-foreground">
            Selected: {selectedFile.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
      )}
    </div>
  );
};
export default UploadModalArea;