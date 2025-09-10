import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, formatTimeAgo } from "@/utils/history-page-utils";
import { TypeHistoryPageChatMetadataProps } from "@/types/TypeUi";

/**
 * Displays responsive and themed metadata for a single chat item with improved mobile layout.
 * Memoized to prevent unnecessary re-renders.
 */
export const HistoryPageChatMetadata = memo(
  ({ chat, file }: TypeHistoryPageChatMetadataProps) => {
    const title = chat.title || file?.name || "Untitled Chat";
    const fileType = file?.type?.toUpperCase() || "FILE";

    return (
      <div className="w-full">
        {/* Mobile Layout: Stack everything vertically */}
        <div className="block sm:hidden space-y-3">
          {/* Title on its own line */}
          <div className="w-full">
            <h3 className="font-medium text-foreground text-base leading-relaxed break-words">
              {title}
            </h3>
          </div>

          {/* Badge and metadata in a row */}
          <div className="flex items-center justify-between">
            <Badge
              variant="secondary"
              className="text-xs px-2.5 py-1 bg-secondary/60 text-secondary-foreground rounded-full"
            >
              {fileType}
            </Badge>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {file?.size && (
                <span className="font-mono">{formatFileSize(file.size)}</span>
              )}
              <span className="font-mono">
                {formatTimeAgo(chat.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Layout: Single row */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="truncate font-medium text-foreground text-base">
              {title}
            </h3>
            <Badge
              variant="secondary"
              className="shrink-0 text-xs px-2.5 py-1 bg-secondary/60 text-secondary-foreground rounded-full"
            >
              {fileType}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
            {file?.size && (
              <span className="font-mono">{formatFileSize(file.size)}</span>
            )}
            <span className="font-mono">{formatTimeAgo(chat.created_at)}</span>
          </div>
        </div>
      </div>
    );
  },
);

HistoryPageChatMetadata.displayName = "HistoryPageChatMetadata";
