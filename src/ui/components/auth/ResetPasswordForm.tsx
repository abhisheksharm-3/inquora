"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";
import { Underlined } from "@/ui/components/shared/Underlined";

/**
 * Choose a new password.
 *
 * No "current password" field, and none is needed: reaching this form requires
 * the session the recovery link issued. On success the action redirects
 * straight into the product rather than back to a sign-in page, because you are
 * already signed in by then and asking again would be theatre.
 */
export const ResetPasswordForm = () => {
  const [state, submit] = useActionState<AuthState, FormData>(setPassword, emptyAuthState);

  return (
    <div>
      <h1 className="mb-3 max-w-[22ch] font-light font-reading text-[2.1rem] text-ink leading-[1.15] tracking-[-0.015em]">
        Choose a new password.
      </h1>
      <p className="mb-9 max-w-[38ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
        This signs you in on this device. Anywhere else stays signed in until it expires.
      </p>

      <form action={submit} noValidate>
        <Field
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least six characters."
          error={state.field === "password" ? state.error : undefined}
        />
        <Action className="mt-7 w-full justify-center" pendingLabel="Saving">
          Save and continue
        </Action>
      </form>

      {state.error && state.field !== "password" ? (
        <p role="alert" className="mt-3 max-w-[38ch] font-record text-label text-danger">
          {state.error}
        </p>
      ) : null}

      <p className="mt-7 font-record text-label text-faint">
        <Underlined href="/forgot-password">Ask for a new link</Underlined>
      </p>
    </div>
  );
};
