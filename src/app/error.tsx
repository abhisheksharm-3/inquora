"use client";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Dither from "@/components/backgrounds/Dither/Dither";
import { TypeErrorProps } from "@/types/ui";

/**
 * A custom error boundary component for the application.
 *
 * This page catches runtime errors and displays a user-friendly fallback UI,
 * providing options to retry the action or return to the homepage.
 *
 * @param {TypeErrorProps} props - Props automatically provided by Next.js.
 * @param {Error} props.error - The error that was thrown.
 * @param {() => void} props.reset - A function to re-render the segment.
 * @returns {JSX.Element} The rendered error page.
 */
const Error = ({ error, reset }: TypeErrorProps) => {
  const destructiveColor: [number, number, number] = [0.9, 0.2, 0.2];

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 -z-10">
        <Dither waveColor={destructiveColor} waveAmplitude={0.1} />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-black/20 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-lg sm:p-12">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Something went wrong
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            We encountered an unexpected error. Our team has been notified and
            is working to fix it.
          </p>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-left">
            <h3 className="mb-2 text-sm font-medium text-destructive-foreground">
              Error Details:
            </h3>
            <p className="font-mono text-xs text-muted-foreground break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="mt-8 flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" variant="destructive" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Error;
