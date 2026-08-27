import {
  RefreshCw,
  X,
  Wifi,
  Server,
  Shield,
  FileX,
  MessageSquare,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { TypeUploadError, TypeUploadModalErrorProps } from "@/types/upload";
import { getUploadErrorTitle } from "@/utils/upload-utils";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { cn } from "@/utils/cn";

/**
 * A modern, warm, and shadcn-compliant error modal for upload failures.
 * Features friendly messaging and proper theming support.
 */
const UploadModalError: React.FC<TypeUploadModalErrorProps> = ({
  error,
  handleRetry,
  canRetry = true,
  isRetrying = false,
  retryCount = 0,
  onContactSupport,
  onDismiss,
}) => {
  const MaxRetries = 3;

  const getUploadErrorIcon = (type: string) => {
    const iconClass = "h-4 w-4";

    switch (type) {
      case "network":
        return <Wifi className={iconClass} />;
      case "server":
        return <Server className={iconClass} />;
      case "auth":
        return <Shield className={iconClass} />;
      case "file_processing":
        return <FileX className={iconClass} />;
      case "chat_creation":
        return <MessageSquare className={iconClass} />;
      case "validation":
        return <AlertTriangle className={iconClass} />;
      default:
        return <AlertTriangle className={iconClass} />;
    }
  };

  const getErrorVariant = (type: string): "default" | "destructive" => {
    switch (type) {
      case "validation":
        return "default"; // Use default for warnings
      case "network":
        return "default";
      default:
        return "destructive";
    }
  };

  const getWarmErrorMessage = (type: string): string => {
    const warmMessages = {
      validation:
        "Oops! There's a small issue with your file that we need to fix before proceeding.",
      network: "We're having trouble connecting right now. This usually resolves quickly!",
      server: "We encountered a temporary hiccup on our end. Our team has been notified.",
      auth: "It looks like your session expired. A quick refresh should get you back on track!",
      file_processing: "We had some trouble processing your file. Let's try a different approach!",
      chat_creation: "Something went wrong while setting up your chat. Let's give it another go!",
      unknown:
        "Something unexpected happened, but don't worry - we'll help you get this sorted out!",
    };

    return warmMessages[type as keyof typeof warmMessages] || warmMessages.unknown;
  };

  const getHelpfulSuggestion = (type: string): string | null => {
    const suggestions = {
      validation:
        "Please check that your file meets the requirements below and try uploading again.",
      network: "Check your internet connection and try again in a moment.",
      server: "Please wait a moment and try again. If this persists, we're here to help!",
      auth: "Simply refresh the page and log back in to continue.",
      file_processing: "Try a different file format or ensure your file isn't corrupted.",
      chat_creation: "This is usually temporary - clicking retry should do the trick!",
    };

    return suggestions[type as keyof typeof suggestions] || null;
  };

  const errorObj: TypeUploadError | null = (() => {
    if (!error) return null;
    if (typeof error === "string") {
      return {
        type: "unknown",
        message: error,
        retryable: true,
      };
    }
    return error;
  })();

  if (!errorObj) return null;

  const variant = getErrorVariant(errorObj.type);
  const shouldShowRetry = canRetry && errorObj.retryable !== false;
  const shouldShowSupport =
    (retryCount >= MaxRetries || errorObj.type === "server") && onContactSupport;
  const warmMessage = getWarmErrorMessage(errorObj.type);
  const helpfulSuggestion = getHelpfulSuggestion(errorObj.type);

  return (
    <Alert variant={variant} className="relative">
      {/* Close Button */}
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="absolute top-2 right-2 h-6 w-6"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}

      {/* Error Icon */}
      {getUploadErrorIcon(errorObj.type)}

      {/* Content */}
      <div className="ml-2 space-y-3 pr-8">
        {/* Header */}
        <div className="space-y-1">
          <h4 className="font-medium leading-none tracking-tight">
            {getUploadErrorTitle(errorObj.type)}
          </h4>
          <AlertDescription className="text-sm leading-relaxed">{warmMessage}</AlertDescription>

          {helpfulSuggestion && (
            <AlertDescription className="text-sm text-muted-foreground mt-2">
              💡 {helpfulSuggestion}
            </AlertDescription>
          )}

          {/* Show original technical message in a subtle way */}
          {errorObj.message !== warmMessage && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Technical details
              </summary>
              <p className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-muted">
                {errorObj.message}
              </p>
            </details>
          )}
        </div>

        {/* Retry Counter */}
        {retryCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Attempt {retryCount + 1} of {MaxRetries + 1}
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {shouldShowRetry && (
            <Button
              onClick={handleRetry}
              disabled={isRetrying || retryCount >= MaxRetries}
              size="sm"
              className="h-8"
            >
              <RefreshCw className={cn("h-3 w-3 mr-2", isRetrying && "animate-spin")} />
              {isRetrying ? "Trying again..." : retryCount > 0 ? "Try again" : "Retry"}
            </Button>
          )}

          {shouldShowSupport && (
            <Button variant="outline" size="sm" onClick={onContactSupport} className="h-8">
              <HelpCircle className="h-3 w-3 mr-2" />
              Get help
            </Button>
          )}

          {onDismiss && !shouldShowRetry && (
            <Button variant="outline" size="sm" onClick={onDismiss} className="h-8">
              Dismiss
            </Button>
          )}
        </div>

        {/* Max Retries Warning */}
        {retryCount >= MaxRetries && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              We&apos;ve tried several times but keep running into the same issue.
              <br />
              <span className="font-medium">What you can do:</span> Try a different file, check your
              internet connection, or reach out to us for help.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Alert>
  );
};

export default UploadModalError;
