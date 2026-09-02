"use client";

import { RiGoogleLine } from "@remixicon/react";
import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { signInWithGoogle } from "@/app/(auth)/actions";
import { Button } from "@/ui/components/ui/button";

export const AuthSocialLogins = (): JSX.Element => {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle(nextUrl);
      if (typeof result === "object" && "url" in result) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <Button
        variant="outline"
        className="h-11 cursor-pointer"
        onClick={handleGoogleSignIn}
        type="button"
      >
        <RiGoogleLine className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
};
