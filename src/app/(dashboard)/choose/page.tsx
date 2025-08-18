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