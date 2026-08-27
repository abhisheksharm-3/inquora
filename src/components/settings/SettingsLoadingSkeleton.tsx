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
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Scrollable Content Area - Full Page Skeleton */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6 chat-list-scroll smooth-scroll">
            <div className="container mx-auto max-w-7xl space-y-8">
              {/* Enhanced Header Section Skeleton */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-12 w-80 bg-gray-700" />
                  <Skeleton className="h-5 w-full max-w-md bg-gray-600" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-24 bg-gray-600 rounded-full" />
                  <Skeleton className="h-6 w-28 bg-gray-600 rounded-full" />
                </div>
              </div>

              {/* Usage Statistics Overview Skeleton - Mobile 2x2 Grid */}
              <div className="grid gap-4 grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card key={`stat-mobile-${index}`} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center space-y-2">
                        <Skeleton className="h-10 w-10 rounded-full bg-gray-700" />
                        <Skeleton className="h-6 w-12 bg-gray-600" />
                        <Skeleton className="h-3 w-16 bg-gray-700" />
                      </div>
                      <div className="mt-3 flex items-center justify-center">
                        <Skeleton className="h-3 w-3 bg-gray-700 mr-1" />
                        <Skeleton className="h-3 w-16 bg-gray-700" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Mobile Single Column Layout */}
              <div className="space-y-6">
                {/* Enhanced Profile Card Skeleton */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
                  <CardHeader className="relative">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <Skeleton className="h-16 w-16 rounded-full bg-gray-700 border-4 border-background" />
                        <Skeleton className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-6 w-32 bg-gray-600" />
                        <Skeleton className="h-4 w-48 bg-gray-700" />
                        <div className="flex items-center space-x-2 pt-2">
                          <Skeleton className="h-5 w-16 bg-gray-600 rounded-full" />
                          <Skeleton className="h-5 w-24 bg-gray-700 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Recent Activity Card Skeleton */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-5 w-5 bg-gray-700" />
                        <Skeleton className="h-6 w-32 bg-gray-600" />
                      </div>
                      <Skeleton className="h-5 w-16 bg-gray-600 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-48 bg-gray-700" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={`mobile-activity-${index}`}>
                          <div className="flex items-center space-x-3 py-2">
                            <Skeleton className="h-6 w-6 rounded-full bg-gray-700" />
                            <div className="flex-1 space-y-1">
                              <Skeleton className="h-4 w-32 bg-gray-600" />
                              <Skeleton className="h-3 w-24 bg-gray-700" />
                            </div>
                            <Skeleton className="h-3 w-12 bg-gray-700" />
                          </div>
                          {index < 2 && <Skeleton className="h-px w-full bg-gray-800" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
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

                {/* Enhanced Subscription Card Skeleton */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-5 bg-primary/50" />
                      <Skeleton className="h-6 w-32 bg-gray-600" />
                    </div>
                    <Skeleton className="h-4 w-56 bg-gray-700" />
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20 bg-primary/50" />
                          <Skeleton className="h-3 w-32 bg-gray-600" />
                        </div>
                        <Skeleton className="h-6 w-16 bg-primary/50 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`mobile-usage-${index}`}
                          className="flex items-center justify-between"
                        >
                          <Skeleton className="h-4 w-24 bg-gray-700" />
                          <Skeleton className="h-4 w-16 bg-gray-600" />
                        </div>
                      ))}
                    </div>
                    <Skeleton className="h-12 w-full bg-primary/20 rounded-md" />
                  </CardContent>
                </Card>

                {/* Preferences Card Skeleton */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-5 bg-gray-700" />
                      <Skeleton className="h-6 w-28 bg-gray-600" />
                    </div>
                    <Skeleton className="h-4 w-40 bg-gray-700" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={`mobile-pref-${index}`}>
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-4 w-4 bg-gray-700" />
                            <Skeleton className="h-4 w-20 bg-gray-600" />
                          </div>
                          <Skeleton className="h-5 w-16 bg-gray-600 rounded-full" />
                        </div>
                        {index < 1 && <Skeleton className="h-px w-full bg-gray-800" />}
                      </div>
                    ))}
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
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Scrollable Content Area - Full Page Skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6 chat-list-scroll smooth-scroll">
          <div className="container mx-auto max-w-7xl space-y-8">
            {/* Enhanced Header Section Skeleton */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-14 w-96 bg-gray-700" />
                  <Skeleton className="h-6 w-[500px] bg-gray-600" />
                </div>
                <div className="hidden md:flex items-center space-x-2">
                  <Skeleton className="h-6 w-24 bg-gray-600 rounded-full" />
                  <Skeleton className="h-6 w-28 bg-gray-600 rounded-full" />
                </div>
              </div>
            </div>

            {/* Usage Statistics Overview Skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={`stat-${index}`} className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full bg-gray-700" />
                      <div>
                        <Skeleton className="h-8 w-16 bg-gray-600 mb-2" />
                        <Skeleton className="h-4 w-24 bg-gray-700" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center">
                      <Skeleton className="h-3 w-3 bg-gray-700 mr-1" />
                      <Skeleton className="h-3 w-20 bg-gray-700" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Profile & Account Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Enhanced Profile Card Skeleton */}
                <Card className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
                  <CardHeader className="relative">
                    <div className="flex items-center space-x-6">
                      <div className="relative">
                        <Skeleton className="h-20 w-20 rounded-full bg-gray-700 border-4 border-background" />
                        <Skeleton className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-8 w-48 bg-gray-600" />
                        <Skeleton className="h-4 w-64 bg-gray-700" />
                        <div className="flex items-center space-x-4 pt-2">
                          <Skeleton className="h-6 w-20 bg-gray-600 rounded-full" />
                          <Skeleton className="h-6 w-32 bg-gray-700 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Recent Activity Card Skeleton */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-5 w-5 bg-gray-700" />
                        <Skeleton className="h-6 w-32 bg-gray-600" />
                      </div>
                      <Skeleton className="h-5 w-16 bg-gray-600 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-48 bg-gray-700" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={`activity-${index}`}>
                          <div className="flex items-center space-x-4 py-3">
                            <Skeleton className="h-8 w-8 rounded-full bg-gray-700" />
                            <div className="flex-1 space-y-1">
                              <Skeleton className="h-4 w-40 bg-gray-600" />
                              <Skeleton className="h-3 w-32 bg-gray-700" />
                            </div>
                            <Skeleton className="h-3 w-16 bg-gray-700" />
                          </div>
                          {index < 2 && <Skeleton className="h-px w-full bg-gray-800" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
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

              {/* Right Column - Subscription, Preferences & Actions */}
              <div className="space-y-6">
                {/* Enhanced Subscription Card Skeleton */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-5 bg-primary/50" />
                      <Skeleton className="h-6 w-32 bg-gray-600" />
                    </div>
                    <Skeleton className="h-4 w-48 bg-gray-700" />
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20 bg-primary/50" />
                          <Skeleton className="h-3 w-32 bg-gray-600" />
                        </div>
                        <Skeleton className="h-6 w-16 bg-primary/50 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={`usage-${index}`} className="flex items-center justify-between">
                          <Skeleton className="h-4 w-24 bg-gray-700" />
                          <Skeleton className="h-4 w-16 bg-gray-600" />
                        </div>
                      ))}
                    </div>
                    <Skeleton className="h-12 w-full bg-primary/20 rounded-md" />
                  </CardContent>
                </Card>

                {/* Preferences Card Skeleton */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-5 bg-gray-700" />
                      <Skeleton className="h-6 w-28 bg-gray-600" />
                    </div>
                    <Skeleton className="h-4 w-40 bg-gray-700" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={`pref-${index}`}>
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-4 w-4 bg-gray-700" />
                            <Skeleton className="h-4 w-20 bg-gray-600" />
                          </div>
                          <Skeleton className="h-5 w-16 bg-gray-600 rounded-full" />
                        </div>
                        {index < 1 && <Skeleton className="h-px w-full bg-gray-800" />}
                      </div>
                    ))}
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
        </div>
      </div>
    </div>
  );
};
