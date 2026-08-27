import { Loader2 } from "lucide-react";

/**
 * A full-screen loading component for the application.
 *
 * Displays a centered spinner and text with the app's signature dithered
 * background, providing a consistent loading state for Next.js routes.
 *
 * @returns {JSX.Element} The rendered loading page.
 */
const Loading = () => {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <div className="relative z-10 flex animate-fade-in flex-col items-center justify-center text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground">Loading</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Please wait while we prepare your experience.
        </p>
      </div>
    </div>
  );
};

export default Loading;
