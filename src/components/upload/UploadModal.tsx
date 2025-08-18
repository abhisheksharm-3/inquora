"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, CircleAlert, Lock, Clock } from "lucide-react";
import { useUploadLogic } from "@/hooks/useUpload";
import { getFileTypeConfig } from "@/constants/FileTypes";
import { useUser } from "@/hooks/useUser";

import UploadModalArea from "./UploadModalArea";
import UploadModalProgress from "./UploadModalProgress";
import UploadModalSuccess from "./UploadModalSuccess";
import UploadModalError from "./UploadModalError";
import UploadModalUrlInput from "./UploadModalUrlInput";
import { TypeUploadModalProps } from "@/types/TypeUpload";

/**
 * A modal dialog for handling file and URL uploads.
 *
 * This component manages the entire upload lifecycle, rendering different UI
 * states (idle, uploading, success, error) based on the `useUploadLogic` hook.
 * It also includes guards for authentication and "coming soon" features.
 *
 * @param {TypeUploadModalProps} props - The component props.
 * @param {React.ReactNode} props.trigger - The UI element that opens the modal.
 * @param {boolean} [props.defaultOpen=false] - If true, the modal opens on initial render.
 * @param {string} props.fileType - Specifies the type of upload (e.g., 'pdf', 'youtube').
 * @returns {JSX.Element} The rendered upload modal component.
 */
const UploadModal: React.FC<TypeUploadModalProps> = ({
  trigger,
  defaultOpen = false,
  fileType,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const { isAuthenticated } = useUser();
  const fileTypeConfig = getFileTypeConfig(fileType);
  const isComingSoon = fileTypeConfig.comingSoon === true;
  const isUrlOnly = fileTypeConfig.urlOnly === true;

  const handleClose = () => {
    setOpen(false);
  };

  const {
    uploadStatus,
    fileName,
    url,
    error,
    selectedFile,
    handleFileChange,
    handleUrlChange,
    handleRemoveFile,
    handleRetry,
    handleSubmit,
    handleKeyDown,
    isUploading,
    resetState,
  } = useUploadLogic({
    fileType,
    onClose: handleClose,
  });

  const handleDismissError = () => {
    if (resetState) {
      resetState();
    }
  };

  // Authentication guard
  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              Authentication Required
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              You need to be logged in to upload files and start chats.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose} className="w-full cursor-pointer">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Coming soon guard
  if (isComingSoon) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              Coming Soon
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {fileTypeConfig.name} uploads are coming soon. We&apos;re working hard
              to bring this feature to you!
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose} className="w-full cursor-pointer">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Main upload modal
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold">
                Upload {fileTypeConfig.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Upload and chat with your {fileTypeConfig.name.toLowerCase()}.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* File upload area - only show if not URL-only */}
          {!isUrlOnly && uploadStatus === "idle" && (
            <UploadModalArea
              fileTypeConfig={fileTypeConfig}
              selectedFile={selectedFile}
              handleFileChange={handleFileChange}
            />
          )}

          {/* Upload progress */}
          {uploadStatus === "uploading" && <UploadModalProgress />}
          
          {/* Upload success */}
          {uploadStatus === "uploaded" && (
            <UploadModalSuccess
              fileName={fileName}
              handleRemoveFile={handleRemoveFile}
            />
          )}
          
          {/* Upload error */}
          {uploadStatus === "error" && (
            <UploadModalError
              error={error}
              handleRetry={handleRetry}
              onDismiss={handleDismissError}
            />
          )}

          {/* Separator between file upload and URL input - only show if not URL-only */}
          {!isUrlOnly && (
            <div className="relative">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground font-medium">
                  OR
                </span>
              </div>
            </div>
          )}

          {/* URL input section */}
          <div className="space-y-4">
            <UploadModalUrlInput
              url={url}
              fileTypeConfig={fileTypeConfig}
              isUrlOnly={isUrlOnly}
              handleUrlChange={handleUrlChange}
              handleUrlSubmit={handleSubmit}
              handleKeyDown={handleKeyDown}
              isUploading={isUploading}
            />

            {/* Access warning alert */}
            <Alert className="border-primary/20 bg-primary/5">
              <CircleAlert className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm font-medium text-primary">
                Please make sure the link can be accessed directly
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/20 p-4 rounded-b-lg">
          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 cursor-pointer"
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 cursor-pointer"
              disabled={
                isUploading || 
                uploadStatus === "uploaded" || 
                (!selectedFile && !url?.trim())
              }
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Uploading...
                </div>
              ) : (
                "Upload"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;