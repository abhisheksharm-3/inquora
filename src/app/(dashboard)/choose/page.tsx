import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import UploadModal from "@/components/upload/UploadModal";
import { Metadata } from "next";
import { FileTypes } from "@/constants/file-types";
import { ChevronDown } from "lucide-react";

/**
 * @description SEO metadata for the new chat/dashboard page.
 */
export const metadata: Metadata = {
  title: "New Chat - Inquora",
  description: "Select a source to start a new conversation.",
};

/**
 * The primary dashboard page where users start a new conversation.
 *
 * It displays a grid of selectable source types (e.g., PDF, URL). Active
 * types trigger an upload modal, while upcoming features are shown as
 * disabled cards.
 *
 * @returns {JSX.Element} The rendered dashboard page.
 */
const ChoosePage = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground md:text-6xl">
          Start a New Conversation
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Choose a source from below to begin uploading your data and chat with
          our intelligent AI.
        </p>

        <div className="mx-auto mt-6 max-w-2xl">
          <div className="flex items-center justify-center gap-4 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 px-6 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">
                All formats working great
              </span>
            </div>
            <div className="h-3 w-px bg-border"></div>

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                  <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <span>Important notices</span>
                  <ChevronDown className="h-3 w-3 transition-transform" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="center">
                <Card className="border-0 shadow-none">
                  <CardContent className="p-4 space-y-4">
                    <div className="text-left">
                      <h4 className="font-medium text-sm text-foreground mb-3">
                        Current Status
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full flex-shrink-0"></div>
                          <span className="text-muted-foreground">
                            PDF, Word, Images, XLSX, Web - Working perfectly
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-amber-500 rounded-full mt-1 flex-shrink-0"></div>
                          <div className="space-y-2">
                            <span className="text-muted-foreground">
                              XLS files - Processing issues
                            </span>
                            <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <span className="text-amber-700 dark:text-amber-300 font-medium">
                                Tip:
                              </span>
                              <span className="text-amber-600 dark:text-amber-400 ml-1">
                                Convert XLS to XLSX for better performance
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                          <div className="space-y-2">
                            <span className="text-muted-foreground">
                              YouTube - May encounter access issues
                            </span>
                            <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                              <span className="text-blue-700 dark:text-blue-300 font-medium">
                                Note:
                              </span>
                              <span className="text-blue-600 dark:text-blue-400 ml-1">
                                YouTube blocks IPs aggressively. A native
                                in-house fix is in development and will launch
                                soon.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-amber-500 rounded-full mt-1 flex-shrink-0"></div>
                          <div className="space-y-2">
                            <span className="text-muted-foreground">
                              GitHub Repositories - Rate Limit Warnings
                            </span>
                            <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <span className="text-amber-700 dark:text-amber-300 font-medium">
                                Important:
                              </span>
                              <span className="text-amber-600 dark:text-amber-400 ml-1">
                                Large repositories (100+ files) may fail due to
                                free API tier rate limits. For best results, use
                                smaller repos. We are working on bypassing these limits.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                          <div className="space-y-2">
                            <span className="text-muted-foreground">
                              Chats older than January 14, 2026 - Read-only
                            </span>
                            <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                              <span className="text-red-700 dark:text-red-300 font-medium">
                                Important:
                              </span>
                              <span className="text-red-600 dark:text-red-400 ml-1">
                                New messages not supported on older chats due to
                                embedding model upgrade. Create a new chat to
                                continue.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:max-w-4xl lg:gap-6">
        {FileTypes.map((fileType) => {
          const IconComponent = fileType.icon;

          return (
            <div key={fileType.type}>
              {fileType.comingSoon ? (
                <Card className="relative h-36 w-full cursor-not-allowed overflow-hidden rounded-2xl border-border/50 bg-background/20 p-4 opacity-50 backdrop-blur-lg">
                  <CardContent className="flex h-full flex-col items-center justify-center gap-3">
                    <IconComponent
                      size={40}
                      color={fileType.iconColor || "#6B7280"}
                      className="opacity-70"
                    />
                    <span className="text-sm font-medium text-center text-muted-foreground">
                      {fileType.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="absolute top-2 right-2 border-primary/50 bg-primary/10 text-primary"
                    >
                      SOON
                    </Badge>
                  </CardContent>
                </Card>
              ) : (
                <UploadModal
                  fileType={fileType.type}
                  trigger={
                    <Card className="group h-36 w-full cursor-pointer overflow-hidden rounded-2xl border-border/50 bg-background/20 p-4 backdrop-blur-lg transition-all duration-300 hover:border-border hover:bg-accent/10 hover:-translate-y-1">
                      <CardContent className="flex h-full flex-col items-center justify-center gap-3">
                        <IconComponent
                          size={40}
                          color={fileType.iconColor || "#6B7280"}
                          className="transition-transform duration-300 group-hover:scale-110"
                        />
                        <span className="text-sm font-medium text-center text-foreground/90">
                          {fileType.name}
                        </span>
                      </CardContent>
                    </Card>
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChoosePage;
