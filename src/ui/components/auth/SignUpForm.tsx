"use client";

import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";
import { Underlined } from "@/ui/components/shared/Underlined";

/**
 * Create an account. On success the action returns a message rather than
 * redirecting, because the account exists but the email is unconfirmed, and
 * sending somebody to a sign-in page that will refuse them is worse than
 * telling them what to do next.
 */
export const SignUpForm = () => {
  const [state, submit] = useActionState<AuthState, FormData>(signUp, emptyAuthState);

  if (state.message) {
    return (
      <div>
        <h1 className="mb-3 font-light font-reading text-[2.1rem] text-ink leading-[1.15] tracking-[-0.015em]">
          One more step.
        </h1>
        <p
          role="status"
          className="max-w-[38ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed"
        >
          {state.message}
        </p>
        <p className="mt-5 font-record text-label text-faint">
          <Underlined href="/login">Back to sign in</Underlined>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-3 max-w-[20ch] font-light font-reading text-[2.1rem] text-ink leading-[1.15] tracking-[-0.015em]">
        Start with one document.
      </h1>
      <p className="mb-9 max-w-[38ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
        A paper, a report, a spreadsheet. Ask it something and follow the answer back.
      </p>

      <form action={submit} noValidate>
        <Field
          name="full-name"
          label="Name"
          autoComplete="name"
          error={state.field === "full-name" ? state.error : undefined}
        />
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
          autoComplete="new-password"
          hint="At least six characters."
          error={state.field === "password" ? state.error : undefined}
        />
        <Action pendingLabel="Creating">Create account</Action>
      </form>

      <p className="mt-5 font-record text-label text-faint">
        <Underlined href="/login">I already have an account</Underlined>
      </p>
    </div>
  );
};
