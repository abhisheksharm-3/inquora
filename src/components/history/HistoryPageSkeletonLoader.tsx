import { TypeSkeletonConfig } from "@/types/ui";
import { Skeleton } from "../ui/skeleton";
import { HistoryPageSkeletonConfigs } from "@/constants/history-page";

/**
 * Reusable skeleton element component with improved theming
 */
const SkeletonElement = ({
  height,
  width,
  className = "",
}: TypeSkeletonConfig) => (
  <Skeleton
    className={`${height} ${width} bg-muted/30 rounded-md animate-pulse ${className}`}
  />
);

/**
 * Enhanced skeleton item component with glass morphism design
 */
export const HistoryChatlistSkeletonItem = () => {
  const mainSkeletonItems: TypeSkeletonConfig[] = [
    HistoryPageSkeletonConfigs.title,
    HistoryPageSkeletonConfigs.badge,
  ];

  return (
    <div className="w-full backdrop-blur-sm bg-card/30 p-5 md:p-6 rounded-xl border border-border/30 animate-pulse">
      {/* Mobile layout: stacked */}
      <div className="block sm:hidden space-y-3">
        <div className="w-full">
          <SkeletonElement height="h-5" width="w-3/4" className="mb-0" />
        </div>
        <div className="flex items-center justify-between">
          <SkeletonElement height="h-5" width="w-12" className="rounded-full" />
          <div className="flex items-center gap-3">
            <SkeletonElement height="h-3" width="w-12" />
            <SkeletonElement height="h-3" width="w-16" />
          </div>
        </div>
      </div>

      {/* Desktop layout: single row */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {mainSkeletonItems.map((config, index) => (
            <SkeletonElement key={index} {...config} />
          ))}
        </div>
        <div className="flex items-center gap-4">
          <SkeletonElement height="h-3" width="w-14" />
          <SkeletonElement height="h-3" width="w-20" />
          <SkeletonElement height="h-9" width="w-9" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
};
