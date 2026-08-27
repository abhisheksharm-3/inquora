import Link from "next/link";
import { JSX } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Error page displayed when OAuth authentication fails.
 * @returns {JSX.Element} The rendered error page component.
 */
const AuthCodeErrorPage = (): JSX.Element => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Authentication Error</h1>
          <p className="text-muted-foreground">
            Sorry, we couldn&apos;t complete your sign-in request. This could be due to:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 text-left">
            <li>• The authentication request was cancelled</li>
            <li>• An error occurred during the OAuth process</li>
            <li>• The session has expired</li>
          </ul>
        </div>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/login">Try Again</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthCodeErrorPage;
