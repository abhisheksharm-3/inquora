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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, CircleAlert, Lock, Clock, Upload, Link } from "lucide-react";
import { useUploadLogic } from "@/hooks/useUpload";
import { getFileTypeConfig } from "@/constants/FileTypes";
import { useUser } from "@/hooks/useUser";

import UploadModalArea from "./UploadModalArea";
import UploadModalProgress from "./UploadModalProgress";
import UploadModalSuccess from "./UploadModalSuccess";
import UploadModalError from "./UploadModalError";
import UploadModalUrlInput from "./UploadModalUrlInput";
import { DocumentProcessingProgress } from "./DocumentProcessingProgress";
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
    isProcessing,
    processingProgress,
    processingError,
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
              {fileTypeConfig.name} uploads are coming soon. We&apos;re working
              hard to bring this feature to you!
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

        <div className="px-6 pb-6">
          {/* Show tabs only in idle state, otherwise show status screens */}
          {uploadStatus === "idle" ? (
            <Tabs defaultValue={isUrlOnly ? "url" : "file"} className="w-full">
              {/* Only show tabs if not URL-only */}
              {!isUrlOnly && (
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="file" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger value="url" className="gap-2">
                    <Link className="h-4 w-4" />
                    Import URL
                  </TabsTrigger>
                </TabsList>
              )}

              {/* File Upload Tab */}
              {!isUrlOnly && (
                <TabsContent value="file" className="space-y-4 mt-0">
                  <UploadModalArea
                    fileTypeConfig={fileTypeConfig}
                    selectedFile={selectedFile}
                    handleFileChange={handleFileChange}
                  />
                  {/* File type specific status message */}
                  {fileTypeConfig.statusMessage && (
                    <Alert
                      className={
                        fileTypeConfig.statusType === "warning"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-blue-500/30 bg-blue-500/5"
                      }
                    >
                      <CircleAlert
                        className={`h-4 w-4 ${
                          fileTypeConfig.statusType === "warning"
                            ? "text-amber-400"
                            : "text-blue-400"
                        }`}
                      />
                      <AlertDescription
                        className={`text-sm ${
                          fileTypeConfig.statusType === "warning"
                            ? "text-amber-200/90"
                            : "text-blue-200/90"
                        }`}
                      >
                        {fileTypeConfig.statusMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              )}

              {/* URL Import Tab */}
              <TabsContent value="url" className="space-y-4 mt-0">
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

                {/* File type specific status message */}
                {fileTypeConfig.statusMessage && (
                  <Alert
                    className={
                      fileTypeConfig.statusType === "warning"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-blue-500/30 bg-blue-500/5"
                    }
                  >
                    <CircleAlert
                      className={`h-4 w-4 ${
                        fileTypeConfig.statusType === "warning"
                          ? "text-amber-400"
                          : "text-blue-400"
                      }`}
                    />
                    <AlertDescription
                      className={`text-sm ${
                        fileTypeConfig.statusType === "warning"
                          ? "text-amber-200/90"
                          : "text-blue-200/90"
                      }`}
                    >
                      {fileTypeConfig.statusMessage}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            /* Status screens when not in idle state */
            <div className="space-y-4">
              {/* Upload progress */}
              {uploadStatus === "uploading" && <UploadModalProgress />}

              {/* Document processing progress */}
              {uploadStatus === "processing" && (
                <DocumentProcessingProgress
                  fileName={fileName || selectedFile?.name || "Document"}
                  fileType={fileType}
                  status="processing"
                  progress={processingProgress}
                  error={processingError}
                  onRetry={handleRetry}
                  canRetry={error?.retryable}
                />
              )}

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
            </div>
          )}
        </div>

        {/* Hide footer during active processing to reduce clutter */}
        {uploadStatus === "idle" && (
          <DialogFooter className="border-t bg-muted/20 p-4 rounded-b-lg">
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 cursor-pointer"
                disabled={!selectedFile && !url?.trim()}
              >
                Upload & Process
              </Button>
            </div>
          </DialogFooter>
        )}

        {/* Show simplified footer with only close option during/after processing */}
        {(uploadStatus === "uploaded" || uploadStatus === "error") && (
          <DialogFooter className="border-t bg-muted/20 p-4 rounded-b-lg">
            <Button
              onClick={handleClose}
              className="w-full cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
