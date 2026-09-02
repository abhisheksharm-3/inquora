"use client";

import Link from "next/link";

/**
 * The error boundary. Cause and next action, in the product's voice, with the
 * digest shown because it is the one thing that makes a report actionable.
 *
 * It replaced a page that led with a 20px warning icon inside a blurred glass
 * card and told the reader a team had been notified.
 */
const ErrorPage = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => (
  <main className="flex min-h-dvh flex-col justify-center px-6 py-7 wide:px-9">
    <div className="max-w-[42ch]">
      <p className="mb-8 font-record text-label text-faint uppercase tracking-[0.16em]">Inquora</p>
      <h1 className="mb-3 font-light font-reading text-[2rem] leading-tight">
        This page did not finish loading.
      </h1>
      <p className="mb-6 font-record text-[0.82rem] text-soft">
        Nothing you had saved is affected. Trying again reloads only this part of the page.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-hair border border-mark px-4 py-2 font-record text-label text-mark uppercase tracking-[0.13em] transition-colors duration-150 ease-out-quart hover:bg-wash"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center border-rule border-b pb-0.5 font-record text-label text-faint hover:text-ink"
        >
          Back to the start
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 border-rule border-t pt-4 font-record text-label text-faint">
          Reference <data value={error.digest}>{error.digest}</data>
        </p>
      ) : null}
    </div>
  </main>
);

export default ErrorPage;
