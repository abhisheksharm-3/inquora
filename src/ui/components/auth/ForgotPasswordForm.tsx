"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";
import { Action } from "@/ui/components/form/Action";
import { Field } from "@/ui/components/form/Field";
import { Underlined } from "@/ui/components/shared/Underlined";

/**
 * Ask for a recovery link.
 *
 * The confirmation is deliberately vague about whether the address has an
 * account, because saying so would let anybody test which addresses are
 * registered here. The person who owns it learns the truth from their inbox.
 */
export const ForgotPasswordForm = () => {
  const [state, submit] = useActionState<AuthState, FormData>(requestPasswordReset, emptyAuthState);

  if (state.message) {
    return (
      <div>
        <h1 className="mb-3 max-w-[20ch] font-light font-reading text-[2.1rem] text-ink leading-[1.15] tracking-[-0.015em]">
          Check your email.
        </h1>
        <p
          role="status"
          className="max-w-[38ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed"
        >
          {state.message}
        </p>
        <p className="mt-7 font-record text-label text-faint">
          <Underlined href="/login">Back to sign in</Underlined>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-3 max-w-[22ch] font-light font-reading text-[2.1rem] text-ink leading-[1.15] tracking-[-0.015em]">
        Set a new password.
      </h1>
      <p className="mb-9 max-w-[38ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
        Tell us the address on your account and we will send you a link. Your documents are
        untouched by this.
      </p>

      <form action={submit} noValidate>
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={state.field === "email" ? state.error : undefined}
        />
        <Action className="mt-7 w-full justify-center" pendingLabel="Sending">
          Send the link
        </Action>
      </form>

      <p className="mt-7 font-record text-label text-faint">
        <Underlined href="/login">Back to sign in</Underlined>
      </p>
    </div>
  );
};
