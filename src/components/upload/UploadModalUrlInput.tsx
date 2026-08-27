"use client";

import { useState, useEffect } from "react";
import { Send, AlertCircle, Link, CheckCircle2 } from "lucide-react";
import { TypeUploadModalUrlInputProps } from "@/types/upload";
import { extractYoutubeVideoId } from "@/utils/youtube-utils";
import { isValidGitHubUrl } from "@/utils/github-utils";
import { isValidWebUrl } from "@/utils/web-scraper-utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/utils/cn";

/**
 * Enhanced URL input component for submitting URLs for processing.
 *
 * Features:
 * - Real-time URL validation feedback
 * - Contextual help for different URL types (YouTube, GitHub, Web)
 * - Smooth animations and visual feedback
 * - Clear submission button
 * - Better visual hierarchy and spacing
 *
 * @param {TypeUploadModalUrlInputProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered URL input component.
 */
const UploadModalUrlInput: React.FC<TypeUploadModalUrlInputProps> = ({
  url,
  fileTypeConfig,
  isUrlOnly,
  handleUrlChange,
  handleUrlSubmit,
  handleKeyDown,
  isUploading,
}) => {
  const [isYouTube, setIsYouTube] = useState(false);
  const [isGitHub, setIsGitHub] = useState(false);
  const [isWebPage, setIsWebPage] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);

  /**
   * Checks if the entered URL is a YouTube link, GitHub repository, or web page to conditionally show help messages.
   */
  useEffect(() => {
    const yt = !!extractYoutubeVideoId(url);
    const gh = isValidGitHubUrl(url);
    const web = isValidWebUrl(url) && !yt && !gh;

    setIsYouTube(yt);
    setIsGitHub(gh);
    setIsWebPage(web);
    setIsValidUrl(yt || gh || web);
  }, [url]);

  return (
    <div className="space-y-4">
      {/* Input label */}
      <div className="flex items-center gap-2">
        <Link className="w-4 h-4 text-muted-foreground" />
        <label className="text-sm font-semibold text-foreground">
          {isUrlOnly ? `Enter ${fileTypeConfig.name} URL` : "Import from URL"}
        </label>
      </div>

      {/* Input field with validation feedback */}
      <div className="relative group">
        <Input
          type="url"
          placeholder={`https://example.com/${fileTypeConfig.name.toLowerCase()}`}
          value={url}
          onChange={handleUrlChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "pr-12 transition-all duration-200 bg-background",
            isValidUrl
              ? "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20"
              : "border-muted-foreground/30 hover:border-muted-foreground/50 focus:border-primary focus:ring-primary/20",
          )}
          disabled={isUploading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isValidUrl && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
          <Button
            size="icon"
            type="button"
            variant={url.trim() ? "default" : "ghost"}
            className={cn(
              "h-8 w-8 transition-all duration-200",
              url.trim()
                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
            onClick={handleUrlSubmit}
            disabled={!url.trim() || isUploading}
            aria-label="Submit URL"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* YouTube detection notice */}
      {isYouTube && (
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm">
            <span className="font-medium">YouTube video detected</span>
            <br />
            <span className="text-xs opacity-90">
              Videos with captions work best. Private videos and auto-generated captions may have
              limited support.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* GitHub detection notice */}
      {isGitHub && (
        <Alert className="border-purple-500/30 bg-purple-500/5">
          <AlertCircle className="h-4 w-4 text-purple-500 flex-shrink-0" />
          <AlertDescription className="text-purple-600 dark:text-purple-400 text-sm">
            <span className="font-medium">GitHub repository detected</span>
            <br />
            <span className="text-xs opacity-90">
              Only public repositories supported. Large repos may take several minutes to process.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Web page detection notice */}
      {isWebPage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <AlertCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          <AlertDescription className="text-emerald-600 dark:text-emerald-400 text-sm">
            <span className="font-medium">Web page detected</span>
            <br />
            <span className="text-xs opacity-90">
              Page content will be extracted and processed. Complex sites with authentication may
              have limitations.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* URL format hint if no valid URL detected yet */}
      {url.trim() && !isValidUrl && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
            <span className="font-medium">URL format not recognized</span>
            <br />
            <span className="text-xs opacity-90">Make sure your URL is valid and accessible</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UploadModalUrlInput;
