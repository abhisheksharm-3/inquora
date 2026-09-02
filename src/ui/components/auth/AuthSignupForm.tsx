"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/components/ui/form";
import { Input } from "@/ui/components/ui/input";
import { useAuth } from "@/ui/hooks/useAuth";
import { signupSchema, type TypeSignupFormValues } from "@/ui/lib/auth.schema";
import { AuthPasswordInput } from "./AuthPasswordInput";
import { AuthStatusMessage } from "./AuthStatusMessage";

const inputClassName =
  "h-10 bg-transparent border-border/80 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:ring-primary";

/**
 * Renders a user sign-up form with client-side validation and submission handling.
 *
 * It uses `react-hook-form` and `zod` for validation and the `useAuth` hook
 * to manage the sign-up logic. The form displays feedback messages for success
 * or error states and uses a grid layout for a compact design.
 *
 * @returns {JSX.Element} The rendered sign-up form component.
 */
export const AuthSignupForm = (): JSX.Element => {
  const form = useForm<TypeSignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const {
    handleSignup: onSubmit,
    isSignupLoading: isLoading,
    signupErrorMessage: error,
    successMessage,
  } = useAuth();

  return (
    <>
      {error && <AuthStatusMessage message={error} type="error" />}
      {successMessage ? (
        <AuthStatusMessage message={successMessage} type="success" />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        className={inputClassName}
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className={inputClassName}
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <AuthPasswordInput
                        field={field}
                        className={inputClassName}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Confirm</FormLabel>
                    <FormControl>
                      <AuthPasswordInput
                        field={field}
                        className={inputClassName}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full !mt-6 h-10" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </Form>
      )}
    </>
  );
};
