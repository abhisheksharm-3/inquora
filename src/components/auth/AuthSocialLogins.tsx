"use client";

import { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";
import { signInWithGoogle } from "@/app/(auth)/actions";

export const AuthSocialLogins = (): JSX.Element => {
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      if (typeof result === 'object' && 'url' in result) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
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
        <Chrome className="mr-2 h-4 w-4" /> 
        Continue with Google
      </Button>
    </div>
  );
};