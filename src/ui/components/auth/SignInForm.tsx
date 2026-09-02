"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInWithGoogle } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";

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
    <div className="max-w-[34ch]">
      <h1 className="mb-2.5 font-light font-reading text-[2rem] leading-tight">
        Pick up where you left off.
      </h1>
      <p className="mb-6 font-record text-[0.82rem] text-soft">
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
          <button type="submit" className="min-h-11 border-rule border-b pb-0.5 hover:text-ink">
            Use Google instead
          </button>
        </form>
        <Link href="/signup" className="min-h-11 border-rule border-b pb-0.5 hover:text-ink">
          Create an account
        </Link>
      </div>

      {googleState.error ? (
        <p role="alert" className="mt-3 font-record text-label text-danger">
          {googleState.error}
        </p>
      ) : null}
    </div>
  );
};
