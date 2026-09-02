import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign-in did not complete",
};

/**
 * The OAuth round trip failed. Cause and next action, beside the thing that
 * failed, in the voice the rest of the product uses. It replaced a page that
 * offered three possible causes and asked the reader to pick one.
 */
const AuthCodeErrorPage = () => (
  <div className="max-w-[38ch]">
    <h1 className="mb-2.5 font-light font-reading text-[2rem] leading-tight">
      That sign-in did not complete.
    </h1>
    <p className="mb-6 font-record text-[0.82rem] text-soft">
      The link was cancelled, or it has already been used. Signing in again issues a fresh one.
    </p>
    <Link
      href="/login"
      className="inline-flex min-h-11 items-center rounded-hair border border-mark px-4 py-2 font-record text-label text-mark uppercase tracking-[0.13em] transition-colors duration-150 ease-out-quart hover:bg-wash"
    >
      Sign in again
    </Link>
  </div>
);

export default AuthCodeErrorPage;
