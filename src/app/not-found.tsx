import Link from "next/link";
import { Button } from "@/ui/components/ui/button";
import { Home } from "lucide-react";

/**
 * Renders a custom 404 "Not Found" page for the application.
 *
 * It features the app's signature dithered background and provides a clear
 * message and a link to return to the homepage.
 *
 * @returns {JSX.Element} The rendered 404 page.
 */
const NotFound = () => {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4">
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-lg sm:p-12">
        <h1 className="text-9xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white/50 to-white/10 md:text-[150px]">
          404
        </h1>

        <div className="mt-6 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Page Not Found
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get
            you back on track.
          </p>
        </div>

        <div className="mt-10">
          <Button
            size="lg"
            className="h-12 w-full bg-primary px-6 text-md font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-105 hover:bg-primary/90 active:scale-100 sm:w-auto"
            asChild
          >
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
