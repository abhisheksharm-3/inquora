import React from "react";
import { Loader2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A presentational component that displays a visual indicator for an ongoing file upload.
 *
 * It features an animated spinner with upload icon and enhanced visual feedback
 * to inform the user that their file is currently being uploaded. This component
 * takes no props and uses shadcn theming for consistent design.
 *
 * @component
 * @returns {JSX.Element} The rendered upload progress indicator.
 */
const UploadModalProgress: React.FC = () => {
  return (
    <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/10 mb-4 transition-all duration-200 hover:border-muted-foreground/40">
      <CardContent className="p-8 text-center flex flex-col items-center justify-center space-y-4">
        {/* Enhanced loading indicator with icon combination */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground/60" />
          </div>
          <Loader2 className="w-12 h-12 text-primary animate-spin absolute inset-0" />
        </div>

        {/* Progress text with better typography */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Uploading your file...
          </p>
          <p className="text-xs text-muted-foreground">
            Please wait while we process your upload
          </p>
        </div>

        {/* Optional animated progress dots */}
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div
            className="w-2 h-2 bg-primary/70 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          ></div>
          <div
            className="w-2 h-2 bg-primary/40 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          ></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadModalProgress;
