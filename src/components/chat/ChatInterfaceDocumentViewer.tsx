// src/components/chat/ChatInterfaceDocumentViewer.tsx

"use client";

import { useState, useEffect, useRef } from "react";
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

/**
 * A sleek, themed toolbar for document controls.
 */
const Controls: React.FC<TypeControlsProps> = ({
  zoomLevel, onZoomIn, onZoomOut, onDownload, onOpenInNewTab, showControls, file,
}) => {
  if (!file || !["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(file.type || "")) {
    return null;
  }

  return (
    <div
      className={`absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg transition-opacity duration-300 ${
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
      <span className="w-16 text-center text-sm font-medium text-muted-foreground">{Math.round(zoomLevel)}%</span>
      <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
      <div className="mx-1 h-6 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="More options"><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDownload}><Download className="mr-2 h-4 w-4" /><span>Download</span></DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenInNewTab}><ExternalLink className="mr-2 h-4 w-4" /><span>Open in new tab</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

interface StateDisplayProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  variant?: 'default' | 'destructive' | 'primary';
  animate?: boolean;
}

/**
 * A themed container for displaying various states (loading, error, empty).
 */
const StateDisplay = ({ icon: Icon, title, message, variant = "default", animate = false }: StateDisplayProps) => {
  // FIX: Added the missing return statement.
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-${variant === 'destructive' ? 'destructive/10' : variant === 'primary' ? 'primary/10' : 'accent'}`}>
        <Icon className={`h-8 w-8 text-${variant === 'destructive' ? 'destructive' : variant === 'primary' ? 'primary' : 'muted-foreground'} ${animate ? 'animate-spin' : ''}`} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

/**
 * A beautiful and versatile document viewer component for the chat interface.
 */
export const ChatInterfaceDocumentViewer: React.FC<TypeChatInterfaceDocumentViewerProps> = ({
  file, isLoading, isError, title,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showControls, setShowControls] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setShowControls(false), 3000);
    };
    const container = containerRef.current;
    container?.addEventListener("mousemove", handleMouseMove);
    return () => { container?.removeEventListener("mousemove", handleMouseMove); clearTimeout(timeoutId); };
  }, []);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));
  const handleDownload = () => file?.url && window.open(file.url, '_blank');
  const handleOpenInNewTab = () => file?.url && window.open(file.url, '_blank');

  // --- Render States ---
  if (isLoading) return <StateDisplay icon={Loader2} title="Loading Document" message="Please wait..." variant="primary" animate />;
  if (isError) return <StateDisplay icon={AlertTriangle} title="Error Loading Document" message="Please try again." variant="destructive" />;
  if (!file) return <StateDisplay icon={FileText} title={title} message="No document is associated with this chat." />;
  if (file.processing_status === "failed") return <StateDisplay icon={AlertTriangle} title="Processing Failed" message={file.processing_error || "This document could not be processed."} variant="destructive" />;
  if (file.processing_status === "processing") return <StateDisplay icon={Loader2} title="Processing Document" message="This may take a moment." variant="primary" animate />;

  // --- Main Renderer ---
  return (
    <div className="relative h-full flex-1" ref={containerRef}>
      {(() => {
        switch (file.type) {
          case "image":
            return <Image src={file.url || ""} alt={file.name} fill className="object-contain p-4" />;

          case "youtube":
            const videoId = file.url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:$|\?|&)/);
            return videoId?.[1]
              ? <iframe src={`https://www.youtube.com/embed/${videoId[1]}`} className="h-full w-full rounded-b-lg border-0" allowFullScreen />
              : <StateDisplay icon={AlertTriangle} title="Invalid YouTube URL" message="We couldn't find a video ID." variant="destructive" />;
          
          case "web":
          case "url":
            return <iframe src={file.url || ""} className="h-full w-full rounded-b-lg border-0 bg-background" title={file.name} />;

          case "pdf":
          case "doc":
          case "docx":
          case "xls":
          case "xlsx":
          case "ppt":
          case "pptx":
            return (
              <div className="h-full w-full overflow-hidden">
                {/* FIX: Controls are now correctly rendered here with the right props passed */}
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
                      style={{ width: `${zoomLevel}%`, height: `${zoomLevel}%`, transform: 'scale(1)', transformOrigin: '0 0' }} 
                      title={file.name} 
                    />
                </div>
              </div>
            );

          default:
            return <StateDisplay icon={FileText} title={file.name} message={`Viewing for "${file.type}" files is not yet supported.`} />;
        }
      })()}
    </div>
  );
};