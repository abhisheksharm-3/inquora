"use client";

import { useState, useEffect } from "react";
import { Send, AlertCircle, Link } from "lucide-react";
import { TypeUploadModalUrlInputProps } from "@/types/TypeUpload";
import { extractYoutubeVideoId } from "@/utils/youtube-utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * A controlled input component for submitting a URL for processing.
 *
 * It features an enhanced submit button with proper theming and displays 
 * contextual messages when YouTube URLs are detected. Uses shadcn theming
 * for consistent design across light/dark modes.
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

  /**
   * Checks if the entered URL is a YouTube link to conditionally show a help message.
   */
  useEffect(() => {
    setIsYouTube(!!extractYoutubeVideoId(url));
  }, [url]);

  return (
    <div className="space-y-3">
      {/* Enhanced label with icon */}
      <div className="flex items-center gap-2">
        <Link className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          {isUrlOnly ? `Enter ${fileTypeConfig.name} URL` : "Import from URL"}
        </p>
      </div>

      {/* Input field with improved styling */}
      <div className="relative group">
        <Input
          type="text"
          placeholder="https://example.com/your-file"
          value={url}
          onChange={handleUrlChange}
          onKeyDown={handleKeyDown}
          className="pr-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-muted-foreground/40"
          disabled={isUploading}
        />
        <Button
          size="icon"
          variant={url.trim() ? "default" : "ghost"}
          className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 transition-all duration-200 ${
            url.trim() 
              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          onClick={handleUrlSubmit}
          disabled={!url.trim() || isUploading}
          aria-label="Submit URL"
        >
          <Send size={14} />
        </Button>
      </div>

      {/* Enhanced YouTube notice with Alert component */}
      {isYouTube && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <span className="font-medium">YouTube video detected:</span> Only videos with available captions can be processed. 
            Private or auto-generated captions may not work reliably.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UploadModalUrlInput;