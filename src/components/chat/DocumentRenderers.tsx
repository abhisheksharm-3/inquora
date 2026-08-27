/**
 * Document type renderers for ChatInterfaceDocumentViewer
 * Each renderer handles a specific document type display
 */

import Image from "next/image";
import { FileText, AlertTriangle, ExternalLink, Globe } from "lucide-react";
import { TypeFile } from "@/types/database";
import { extractYoutubeVideoId } from "@/utils/youtube-utils";

interface StateDisplayProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  variant?: "default" | "destructive" | "primary";
}

function StateDisplayInline({
  icon: Icon,
  title,
  message,
  variant = "default",
}: StateDisplayProps) {
  const bgClass =
    variant === "destructive"
      ? "bg-destructive/10"
      : variant === "primary"
        ? "bg-primary/10"
        : "bg-accent";
  const iconColor =
    variant === "destructive"
      ? "text-destructive"
      : variant === "primary"
        ? "text-primary"
        : "text-muted-foreground";

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${bgClass}`}>
        <Icon className={`h-8 w-8 ${iconColor}`} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ImageRenderer({ file }: { file: TypeFile }) {
  return <Image src={file.url || ""} alt={file.name} fill className="object-contain p-4" />;
}

export function YouTubeRenderer({ file }: { file: TypeFile }) {
  const videoId = file.url ? extractYoutubeVideoId(file.url) : null;

  if (!videoId) {
    return (
      <StateDisplayInline
        icon={AlertTriangle}
        title="Invalid YouTube URL"
        message="We couldn't find a video ID in the provided URL."
        variant="destructive"
      />
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}`}
      className="h-full w-full rounded-b-lg border-0"
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      title={file.name}
    />
  );
}

export function WebPageRenderer({ file }: { file: TypeFile }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-green-100 dark:bg-green-900 p-4">
        <Globe className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-medium text-foreground">Web Page</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{file.name?.replace(/\.web$/, "")}</p>
        <a
          href={file.url || ""}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          View Web Page
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export function GitHubRenderer({ file }: { file: TypeFile }) {
  const repoName = file.name?.replace(/_repository\.github$/, "").replace(/_/g, "/");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-purple-500/10 p-4">
        <svg className="h-8 w-8 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-medium text-foreground">GitHub Repository</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{repoName}</p>
        <a
          href={file.url || ""}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          View on GitHub
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export function DocumentRenderer({ file, zoomLevel }: { file: TypeFile; zoomLevel: number }) {
  return (
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
  );
}

export function UnsupportedRenderer({ file }: { file: TypeFile }) {
  return (
    <StateDisplayInline
      icon={FileText}
      title={file.name}
      message={`Viewing for "${file.type}" files is not yet supported.`}
    />
  );
}
