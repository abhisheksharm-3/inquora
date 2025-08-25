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
import { TypeChatInterfaceDocumentViewerProps, TypeControlsProps } from "@/types/TypeChat";

const DOCUMENT_TYPES = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

const Controls = memo<TypeControlsProps>(({
  zoomLevel, onZoomIn, onZoomOut, onDownload, onOpenInNewTab, showControls, file,
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
      <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom out">
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
});

interface StateDisplayProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  variant?: 'default' | 'destructive' | 'primary';
  animate?: boolean;
}

const StateDisplay = memo<StateDisplayProps>(({ icon: Icon, title, message, variant = "default", animate = false }) => {
  const getBackgroundClass = () => {
    switch (variant) {
      case 'destructive': return 'bg-destructive/10';
      case 'primary': return 'bg-primary/10';
      default: return 'bg-accent';
    }
  };

  const getIconClass = () => {
    const baseClass = 'h-8 w-8';
    const colorClass = variant === 'destructive' ? 'text-destructive' : 
                      variant === 'primary' ? 'text-primary' : 'text-muted-foreground';
    const animateClass = animate ? 'animate-spin' : '';
    return `${baseClass} ${colorClass} ${animateClass}`;
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${getBackgroundClass()}`}>
        <Icon className={getIconClass()} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
});

const ChatInterfaceDocumentViewerComponent: React.FC<TypeChatInterfaceDocumentViewerProps> = ({
  file, isLoading, isError, title,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showControls, setShowControls] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => setZoomLevel((prev) => Math.min(prev + 10, 200)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((prev) => Math.max(prev - 10, 50)), []);
  const handleDownload = useCallback(() => file?.url && window.open(file.url, '_blank'), [file?.url]);
  const handleOpenInNewTab = useCallback(() => file?.url && window.open(file.url, '_blank'), [file?.url]);

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

  if (isLoading) return <StateDisplay icon={Loader2} title="Loading Document" message="Please wait..." variant="primary" animate />;
  if (isError) return <StateDisplay icon={AlertTriangle} title="Error Loading Document" message="Please try again." variant="destructive" />;
  if (!file) return <StateDisplay icon={FileText} title={title} message="No document is associated with this chat." />;
  if (file.processing_status === "failed") return <StateDisplay icon={AlertTriangle} title="Processing Failed" message={file.processing_error || "This document could not be processed."} variant="destructive" />;
  if (file.processing_status === "processing") return <StateDisplay icon={Loader2} title="Processing Document" message="This may take a moment." variant="primary" animate />;

  const renderContent = () => {
    switch (file.type) {
      case "image":
        return <Image src={file.url || ""} alt={file.name} fill className="object-contain p-4" />;

      case "youtube": {
        const videoId = file.url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:$|\?|&)/);
        return videoId?.[1] ? (
          <iframe 
            src={`https://www.youtube.com/embed/${videoId[1]}`} 
            className="h-full w-full rounded-b-lg border-0" 
            allowFullScreen 
          />
        ) : (
          <StateDisplay 
            icon={AlertTriangle} 
            title="Invalid YouTube URL" 
            message="We couldn't find a video ID." 
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
                  transform: 'scale(1)', 
                  transformOrigin: '0 0' 
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

Controls.displayName = 'Controls';
StateDisplay.displayName = 'StateDisplay';

export const ChatInterfaceDocumentViewer = memo(ChatInterfaceDocumentViewerComponent, (prevProps, nextProps) => {
  const prevFile = prevProps.file;
  const nextFile = nextProps.file;
  
  const filesEqual = (
    prevFile?.id === nextFile?.id &&
    prevFile?.url === nextFile?.url &&
    prevFile?.type === nextFile?.type &&
    prevFile?.name === nextFile?.name &&
    prevFile?.processing_status === nextFile?.processing_status &&
    prevFile?.processing_error === nextFile?.processing_error
  );
  
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isError === nextProps.isError &&
    prevProps.title === nextProps.title &&
    filesEqual
  );
});

ChatInterfaceDocumentViewer.displayName = 'ChatInterfaceDocumentViewer';