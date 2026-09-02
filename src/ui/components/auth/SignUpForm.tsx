"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";

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
      <div className="max-w-[34ch]">
        <h1 className="mb-2.5 font-light font-reading text-[2rem] leading-tight">One more step.</h1>
        <p role="status" className="font-record text-[0.82rem] text-soft">
          {state.message}
        </p>
        <p className="mt-5 font-record text-label text-faint">
          <Link href="/login" className="border-rule border-b pb-0.5 hover:text-ink">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[34ch]">
      <h1 className="mb-2.5 font-light font-reading text-[2rem] leading-tight">
        Start with one document.
      </h1>
      <p className="mb-6 font-record text-[0.82rem] text-soft">
        A paper, a repository, a spreadsheet. Ask it something and follow the answer back.
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
        <Link href="/login" className="border-rule border-b pb-0.5 hover:text-ink">
          I already have an account
        </Link>
      </p>
    </div>
  );
};
