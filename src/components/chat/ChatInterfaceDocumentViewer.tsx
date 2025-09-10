"use client";

import { useState, useEffect, useRef, memo, useCallback } from "react";
import Image from "next/image";
import {
  Loader2,
  FileText,
  ZoomIn,
  ZoomOut,
  MoreVertical,
  Download,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  TypeChatInterfaceDocumentViewerProps,
  TypeControlsProps,
} from "@/types/TypeChat";
import { extractYoutubeVideoId } from "@/utils/youtube-utils";

const DOCUMENT_TYPES = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

const Controls = memo<TypeControlsProps>(
  ({
    zoomLevel,
    onZoomIn,
    onZoomOut,
    onDownload,
    onOpenInNewTab,
    showControls,
    file,
  }) => {
    if (!file || !DOCUMENT_TYPES.has(file.type || "")) {
      return null;
    }

    return (
      <div
        className={`absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-16 text-center text-sm font-medium text-muted-foreground">
          {Math.round(zoomLevel)}%
        </span>
        <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="More options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              <span>Download</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>Open in new tab</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);

interface StateDisplayProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  variant?: "default" | "destructive" | "primary";
  animate?: boolean;
}

const StateDisplay = memo<StateDisplayProps>(
  ({ icon: Icon, title, message, variant = "default", animate = false }) => {
    const getBackgroundClass = () => {
      switch (variant) {
        case "destructive":
          return "bg-destructive/10";
        case "primary":
          return "bg-primary/10";
        default:
          return "bg-accent";
      }
    };

    const getIconClass = () => {
      const baseClass = "h-8 w-8";
      const colorClass =
        variant === "destructive"
          ? "text-destructive"
          : variant === "primary"
            ? "text-primary"
            : "text-muted-foreground";
      const animateClass = animate ? "animate-spin" : "";
      return `${baseClass} ${colorClass} ${animateClass}`;
    };

    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ${getBackgroundClass()}`}
        >
          <Icon className={getIconClass()} />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    );
  },
);

const ChatInterfaceDocumentViewerComponent: React.FC<
  TypeChatInterfaceDocumentViewerProps
> = ({ file, isLoading, isError, title }) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showControls, setShowControls] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(
    () => setZoomLevel((prev) => Math.min(prev + 10, 200)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoomLevel((prev) => Math.max(prev - 10, 50)),
    [],
  );
  const handleDownload = useCallback(
    () => file?.url && window.open(file.url, "_blank"),
    [file?.url],
  );
  const handleOpenInNewTab = useCallback(
    () => file?.url && window.open(file.url, "_blank"),
    [file?.url],
  );

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setShowControls(false), 3000);
    };

    const container = containerRef.current;
    container?.addEventListener("mousemove", handleMouseMove);
    return () => {
      container?.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, []);

  if (isLoading)
    return (
      <StateDisplay
        icon={Loader2}
        title="Loading Document"
        message="Please wait..."
        variant="primary"
        animate
      />
    );
  if (isError)
    return (
      <StateDisplay
        icon={AlertTriangle}
        title="Error Loading Document"
        message="Please try again."
        variant="destructive"
      />
    );
  if (!file)
    return (
      <StateDisplay
        icon={FileText}
        title={title}
        message="No document is associated with this chat."
      />
    );
  if (file.processing_status === "failed")
    return (
      <StateDisplay
        icon={AlertTriangle}
        title="Processing Failed"
        message={
          file.processing_error || "This document could not be processed."
        }
        variant="destructive"
      />
    );
  if (file.processing_status === "processing")
    return (
      <StateDisplay
        icon={Loader2}
        title="Processing Document"
        message="This may take a moment."
        variant="primary"
        animate
      />
    );

  const renderContent = () => {
    switch (file.type) {
      case "image":
        return (
          <Image
            src={file.url || ""}
            alt={file.name}
            fill
            className="object-contain p-4"
          />
        );

      case "youtube": {
        // Extract video ID using the utility function for consistency
        const videoId = file.url ? extractYoutubeVideoId(file.url) : null;
        return videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
            className="h-full w-full rounded-b-lg border-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={file.name}
          />
        ) : (
          <StateDisplay
            icon={AlertTriangle}
            title="Invalid YouTube URL"
            message="We couldn't find a video ID in the provided URL."
            variant="destructive"
          />
        );
      }

      case "web":
      case "url":
        return (
          <iframe
            src={file.url || ""}
            className="h-full w-full rounded-b-lg border-0 bg-background"
            title={file.name}
          />
        );

      case "github":
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <div className="rounded-full bg-purple-500/10 p-4">
              <svg
                className="h-8 w-8 text-purple-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-medium text-foreground">GitHub Repository</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {file.name
                  ?.replace(/_repository\.github$/, "")
                  .replace(/_/g, "/")}
              </p>
              <a
                href={file.url || ""}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View on GitHub
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        );

      case "web":
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-4">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9"
                />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-medium text-foreground">Web Page</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {file.name?.replace(/\.web$/, "")}
              </p>
              <a
                href={file.url || ""}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View Web Page
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        );

      case "pdf":
      case "doc":
      case "docx":
      case "xls":
      case "xlsx":
      case "ppt":
      case "pptx":
        return (
          <div className="h-full w-full overflow-hidden">
            <Controls
              zoomLevel={zoomLevel}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onDownload={handleDownload}
              onOpenInNewTab={handleOpenInNewTab}
              showControls={showControls}
              file={file}
            />
            <div className="h-full w-full overflow-auto">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.url || "")}&embedded=true`}
                className="border-0"
                style={{
                  width: `${zoomLevel}%`,
                  height: `${zoomLevel}%`,
                  transform: "scale(1)",
                  transformOrigin: "0 0",
                }}
                title={file.name}
              />
            </div>
          </div>
        );

      default:
        return (
          <StateDisplay
            icon={FileText}
            title={file.name}
            message={`Viewing for "${file.type}" files is not yet supported.`}
          />
        );
    }
  };

  return (
    <div className="relative h-full flex-1" ref={containerRef}>
      {renderContent()}
    </div>
  );
};

Controls.displayName = "Controls";
StateDisplay.displayName = "StateDisplay";

export const ChatInterfaceDocumentViewer = memo(
  ChatInterfaceDocumentViewerComponent,
  (prevProps, nextProps) => {
    const prevFile = prevProps.file;
    const nextFile = nextProps.file;

    const filesEqual =
      prevFile?.id === nextFile?.id &&
      prevFile?.url === nextFile?.url &&
      prevFile?.type === nextFile?.type &&
      prevFile?.name === nextFile?.name &&
      prevFile?.processing_status === nextFile?.processing_status &&
      prevFile?.processing_error === nextFile?.processing_error;

    return (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.isError === nextProps.isError &&
      prevProps.title === nextProps.title &&
      filesEqual
    );
  },
);

ChatInterfaceDocumentViewer.displayName = "ChatInterfaceDocumentViewer";
