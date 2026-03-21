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
import { X, CircleAlert, Lock, Clock, Upload, Link, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { useUploadLogic } from "@/hooks/useUpload";
import { getFileTypeConfig } from "@/constants/file-types";
import { useUser } from "@/hooks/useUser";
import { withErrorBoundary } from "@/components/shared/ErrorBoundary";

import UploadModalArea from "./UploadModalArea";
import UploadModalProgress from "./UploadModalProgress";
import UploadModalSuccess from "./UploadModalSuccess";
import UploadModalError from "./UploadModalError";
import UploadModalUrlInput from "./UploadModalUrlInput";
import { DocumentProcessingProgress } from "./DocumentProcessingProgress";
import { TypeUploadModalProps } from "@/types/upload";

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

  const {
    uploadStatus,
    fileName,
    url,
    error,
    selectedFile,
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
    onClose: () => {
      setOpen(false);
    },
  });

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const handleDismissError = () => {
    resetState();
  };

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

  const isActivePhase =
    uploadStatus === "uploading" || uploadStatus === "processing";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold">
                Upload {fileTypeConfig.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Add your {fileTypeConfig.name.toLowerCase()} to get started with
                AI-powered analysis
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-lg cursor-pointer flex-shrink-0 hover:bg-muted"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 py-6 overflow-y-auto flex-1">
          {uploadStatus === "idle" ? (
            <Tabs defaultValue={isUrlOnly ? "url" : "file"} className="w-full">
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

              {!isUrlOnly && (
                <TabsContent value="file" className="space-y-4 mt-0">
                  <UploadModalArea
                    fileTypeConfig={fileTypeConfig}
                    selectedFile={selectedFile}
                    handleFileChange={handleFileChange}
                    handleRemoveFile={handleRemoveFile}
                  />
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

                <Alert className="border-primary/20 bg-primary/5">
                  <CircleAlert className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium text-primary">
                    Please make sure the link can be accessed directly
                  </AlertDescription>
                </Alert>

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
            <div className="space-y-6">
              {isActivePhase && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        uploadStatus === "uploading"
                          ? "bg-primary text-primary-foreground"
                          : "bg-emerald-500 text-white",
                      )}
                    >
                      {uploadStatus === "uploading" ? (
                        "1"
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        uploadStatus !== "uploading" &&
                          "text-muted-foreground",
                      )}
                    >
                      Upload
                    </span>
                  </div>

                  <div
                    className={cn(
                      "flex-1 h-px transition-colors",
                      uploadStatus === "processing"
                        ? "bg-emerald-500"
                        : "bg-muted",
                    )}
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        uploadStatus === "processing"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      2
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        uploadStatus !== "processing" &&
                          "text-muted-foreground",
                      )}
                    >
                      Process
                    </span>
                  </div>

                  <div className="flex-1 h-px bg-muted" />

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">
                      3
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Ready
                    </span>
                  </div>
                </div>
              )}

              {uploadStatus === "uploading" && (
                <UploadModalProgress
                  fileName={fileName || selectedFile?.name}
                />
              )}

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

              {uploadStatus === "uploaded" && (
                <UploadModalSuccess
                  fileName={fileName}
                  handleRemoveFile={handleRemoveFile}
                />
              )}

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

        {uploadStatus === "idle" && (
          <DialogFooter className="border-t border-border/50 bg-muted/30 px-6 py-4 gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="cursor-pointer"
              disabled={!selectedFile && !url?.trim()}
            >
              Upload & Process
            </Button>
          </DialogFooter>
        )}

        {(uploadStatus === "uploaded" || uploadStatus === "error") && (
          <DialogFooter className="border-t border-border/50 bg-muted/30 px-6 py-4">
            <Button onClick={handleClose} className="cursor-pointer">
              Close & Start Chat
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(UploadModal, { name: "UploadModal" });
