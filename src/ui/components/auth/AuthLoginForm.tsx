"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { loginSchema, TypeLoginFormValues } from "@/ui/lib/auth.schema";
import { AuthPasswordInput } from "./AuthPasswordInput";
import { AuthStatusMessage } from "./AuthStatusMessage";
import { useAuth } from "@/ui/hooks/useAuth";
import { JSX } from "react";

const inputClassName =
  "h-12 bg-transparent border-border/80 transition-colors focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:ring-primary";

/**
 * Renders a user login form with client-side validation and submission handling.
 *
 * It uses `react-hook-form` for state management, `zod` for validation, and the
 * `useAuth` hook to manage the authentication logic, including loading and error
 * states.
 *
 * @returns {JSX.Element} The rendered login form component.
 */
export const AuthLoginForm = (): JSX.Element => {
  const form = useForm<TypeLoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
  });

  const { handleLogin: onSubmit, isLoginLoading: isLoading, loginErrorMessage: error } = useAuth();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-700 delay-150">
      {error && <AuthStatusMessage message={error} type="error" />}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

          <Button
            type="submit"
            className="h-12 cursor-pointer w-full !mt-8 text-md font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.99]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};
