"use client";

import { useActionState } from "react";
import { signIn } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";
import { Underlined } from "@/ui/components/shared/Underlined";
import { GoogleForm } from "./GoogleForm";

/**
 * Sign in. Two forms rather than one, because the password path and the Google
 * path are separate actions with separate failures, and a shared state would
 * make a Google outage read as a wrong password.
 *
 * This replaced a 250-line TanStack Query mutation stack with its own retry
 * policy, error taxonomy and client-side navigation. `useActionState` carries
 * the pending state, the error and the redirect, and the retry policy for a
 * wrong password was never wanted: the module rate-limits the attempt.
 */
export const SignInForm = ({ next }: { next?: string }) => {
  const [state, submit] = useActionState<AuthState, FormData>(signIn, emptyAuthState);

  return (
    <div>
      <h1 className="mb-3 max-w-[20ch] font-light font-reading text-[2.1rem] text-ink leading-[1.15] tracking-[-0.015em]">
        Pick up where you left off.
      </h1>
      <p className="mb-9 max-w-[38ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
        Your documents, and every answer traced back to them.
      </p>

      <form action={submit} noValidate>
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={state.field === "email" ? state.error : undefined}
        />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={state.field === "password" ? state.error : undefined}
        />
        {/* Under the field it concerns and on the same left edge as everything
            else in the stack. Right-aligned it floated between two gaps with
            nothing to align to, since every label in this form is left-set. */}
        <p className="-mt-4 mb-8 font-record text-label text-faint">
          <Underlined href="/forgot-password">Forgotten your password?</Underlined>
        </p>

        <Action className="w-full justify-center" pendingLabel="Signing in">
          Continue
        </Action>
      </form>

      <GoogleForm next={next} label="Continue with Google" />

      <p className="mt-7 font-record text-label text-faint">
        <Underlined href="/signup">Create an account</Underlined>
      </p>
    </div>
  );
};
