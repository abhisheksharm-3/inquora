import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Reusable skeleton loader component for settings pages and dialogs
 *
 * @param isMobile - If true, renders mobile-optimized skeleton layout
 */
export const SettingsLoadingSkeleton = ({ isMobile = false }) => {
  if (isMobile) {
    return (
      <div className="container mx-auto max-w-6xl space-y-8 p-6">
        {/* Header Section Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-12 w-80 bg-gray-700" />
          <Skeleton className="h-5 w-96 bg-gray-600" />
        </div>

        {/* Mobile Single Column Layout */}
        <div className="space-y-6">
          {/* Profile Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-full bg-gray-700" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32 bg-gray-600" />
                  <Skeleton className="h-4 w-48 bg-gray-700" />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Account Details Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 bg-gray-700" />
                <Skeleton className="h-6 w-40 bg-gray-600" />
              </div>
              <Skeleton className="h-4 w-64 bg-gray-700" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`mobile-detail-${index}`}>
                    <div className="flex items-center justify-between py-3">
                      <Skeleton className="h-4 w-24 bg-gray-700" />
                      <Skeleton className="h-4 w-32 bg-gray-600" />
                    </div>
                    {index < 2 && <Skeleton className="h-px w-full bg-gray-800" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subscription Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 bg-gray-700" />
                <Skeleton className="h-6 w-32 bg-gray-600" />
              </div>
              <Skeleton className="h-4 w-56 bg-gray-700" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20 bg-gray-700" />
                    <Skeleton className="h-3 w-32 bg-gray-600" />
                  </div>
                  <Skeleton className="h-6 w-16 bg-gray-600 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-12 w-full bg-primary/20 rounded-md" />
            </CardContent>
          </Card>

          {/* Account Actions Card Skeleton */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 bg-destructive/50" />
                <Skeleton className="h-6 w-36 bg-destructive/50" />
              </div>
              <Skeleton className="h-4 w-52 bg-gray-700" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full bg-destructive/20 rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="container mx-auto max-w-6xl space-y-8 p-6">
      {/* Header Section Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-14 w-96 bg-gray-700" />
        <Skeleton className="h-6 w-[500px] bg-gray-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Profile & Account Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-full bg-gray-700" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40 bg-gray-600" />
                  <Skeleton className="h-4 w-56 bg-gray-700" />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Account Details Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 bg-gray-700" />
                <Skeleton className="h-6 w-44 bg-gray-600" />
              </div>
              <Skeleton className="h-4 w-72 bg-gray-700" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`desktop-detail-${index}`}>
                    <div className="flex items-center justify-between py-3">
                      <Skeleton className="h-4 w-28 bg-gray-700" />
                      <Skeleton className="h-4 w-36 bg-gray-600" />
                    </div>
                    {index < 2 && <Skeleton className="h-px w-full bg-gray-800" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Subscription & Actions */}
        <div className="space-y-6">
          {/* Subscription Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 bg-gray-700" />
                <Skeleton className="h-6 w-32 bg-gray-600" />
              </div>
              <Skeleton className="h-4 w-48 bg-gray-700" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20 bg-gray-700" />
                    <Skeleton className="h-3 w-32 bg-gray-600" />
                  </div>
                  <Skeleton className="h-6 w-16 bg-gray-600 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-12 w-full bg-primary/20 rounded-md" />
            </CardContent>
          </Card>

          {/* Account Actions Card Skeleton */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 bg-destructive/50" />
                <Skeleton className="h-6 w-36 bg-destructive/50" />
              </div>
              <Skeleton className="h-4 w-52 bg-gray-700" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full bg-destructive/20 rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
