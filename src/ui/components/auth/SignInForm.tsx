"use client";

import { useActionState } from "react";
import { signIn, signInWithGoogle } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";
import { Underlined } from "@/ui/components/shared/Underlined";

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
  const [googleState, submitGoogle] = useActionState<AuthState, FormData>(
    signInWithGoogle,
    emptyAuthState,
  );

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
        <Action pendingLabel="Signing in">Continue</Action>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-3.5 font-record text-label text-faint">
        <form action={submitGoogle}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-faint hover:text-ink"
          >
            <span className="border-rule border-b pb-1">Use Google instead</span>
          </button>
        </form>
        <Underlined href="/signup">Create an account</Underlined>
      </div>

      {googleState.error ? (
        <p role="alert" className="mt-3 font-record text-label text-danger">
          {googleState.error}
        </p>
      ) : null}
    </div>
  );
};
