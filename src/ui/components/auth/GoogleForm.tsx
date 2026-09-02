"use client";

import { useActionState } from "react";
import { signInWithGoogle } from "@/app/(auth)/actions";
import { type AuthState, emptyAuthState } from "@/app/(auth)/auth.types";

/**
 * The Google path, on both authentication screens.
 *
 * Its own form and its own state, because a Google outage and a wrong password
 * are different failures and one shared state would report the first as the
 * second. It was on sign in only, which meant the fastest way to create an
 * account was missing from the page for creating one.
 *
 * A bordered control rather than a text link: it is a real alternative to the
 * form above it, not a footnote to it. Quiet, though — the rule is `rule`, not
 * the mark, because the mark belongs to the primary action.
 */
export const GoogleForm = ({ next, label }: { next?: string; label: string }) => {
  const [state, submit] = useActionState<AuthState, FormData>(signInWithGoogle, emptyAuthState);

  return (
    <>
      <div className="my-7 flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-rule" />
        <span className="font-record text-label text-faint uppercase tracking-[0.13em]">or</span>
        <span aria-hidden className="h-px flex-1 bg-rule" />
      </div>

      <form action={submit}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-hair border border-rule px-4 font-record text-[0.72rem] text-soft uppercase tracking-[0.11em] transition-colors duration-150 ease-out-quart hover:border-soft hover:text-ink"
        >
          <GoogleMark />
          {label}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 font-record text-label text-danger">
          {state.error}
        </p>
      ) : null}
    </>
  );
};

/**
 * Google's own four colours, which is how their brand guidance requires the
 * mark to appear. It is the one place in this interface with a colour that is
 * not a token, and the reason is that the alternative is misrepresenting
 * somebody else's mark.
 */
function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.09l3.01-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
