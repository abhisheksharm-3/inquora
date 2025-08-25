import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UploadModal from "@/components/upload/UploadModal";
import { Metadata } from "next";
import { FileTypes } from "@/constants/FileTypes";

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
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground md:text-6xl">
          Start a New Conversation
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Choose a source from below to begin uploading your data and chat with
          our intelligent AI.
        </p>
        <div className="mx-auto mt-6 max-w-2xl">
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors list-none py-2 px-4 rounded-lg hover:bg-accent/50">
              <div className="inline-flex items-center gap-2">
                <div className="flex h-2 w-2 items-center justify-center">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                  PDF, Word, Images working great
                </Badge>
              </div>
              <div className="h-1 w-1 bg-muted-foreground/50 rounded-full"></div>
              <div className="inline-flex items-center gap-2">
                <div className="flex h-2 w-2 items-center justify-center">
                  <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
                </div>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                  Slides, YouTube, Excel having issues
                </Badge>
              </div>
              <svg className="h-4 w-4 transition-transform group-open:rotate-180 ml-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            
            <Card className="mt-4 border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                    <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">Working perfectly</h4>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs">
                        STABLE
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">PDF, Word documents, images, and Excel spreadsheets process reliably</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 mt-0.5">
                    <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">Currently buggy</h4>
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-xs">
                        FIXING
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">Slides have issues with their XML format, YouTube API is acting up. We're fixing these soon.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </details>
        </div>
      </div>
      <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:max-w-4xl lg:gap-6">
        {FileTypes.map((fileType) => {
          const IconComponent = fileType.icon;
          
          return (
            <div key={fileType.type}>
              {fileType.comingSoon ? (
                <Card className="relative h-36 w-full cursor-not-allowed overflow-hidden rounded-2xl border-border/50 bg-background/20 p-4 opacity-50 backdrop-blur-lg">
                  <CardContent className="flex h-full flex-col items-center justify-center gap-3">
                    <IconComponent
                      size={40}
                      color={fileType.iconColor || '#6B7280'}
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
                          color={fileType.iconColor || '#6B7280'}
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