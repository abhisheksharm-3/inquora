import Link from "next/link";
import { ThemeToggle } from "@/ui/components/shared/ThemeToggle";

/**
 * The header on the two pages a stranger sees.
 *
 * Three elements on the right, in two languages: text for where you can go, a
 * bordered control for the one thing to do. That is the whole idea, and it took
 * three failed versions to get to it.
 *
 * The theme is one button at the end, cycling the three states and showing the
 * one in force. It was three words, then a bordered segmented control, then
 * three loose marks: every version put all three states on the bar and added a
 * third control language to it. One object at the end of the row is one object.
 *
 * The oxide mark appears exactly once on this bar. It appeared three times in
 * an earlier version — wordmark, active theme icon, call to action — and three
 * accents is no accent.
 */
export const SiteHeader = ({
  current,
  /**
   * `auth` drops the two calls to action, because the form on the page is the
   * call to action and the link under it is the other one.
   */
  variant = "marketing",
}: {
  current?: "how";
  variant?: "marketing" | "auth";
}) => (
  <header className="sticky top-0 z-10 border-rule border-b bg-ground">
    <div className="flex h-16 items-center justify-between gap-4 px-6 sm:px-7 wide:px-10">
      <Link href="/" className="font-reading text-[1.2rem] text-ink tracking-[0.01em]">
        Inquora
      </Link>

      <nav className="flex items-center gap-4 sm:gap-6">
        <Link
          href="/how-it-works"
          aria-current={current === "how" ? "page" : undefined}
          // Hidden on a phone in the marketing bar, which already carries two
          // calls to action, and shown in the auth bar, which carries none.
          className={`h-9 items-center whitespace-nowrap font-record text-[0.72rem] uppercase tracking-[0.11em] ${
            variant === "auth" ? "flex" : "hidden sm:flex"
          } ${current === "how" ? "text-ink" : "text-soft hover:text-ink"}`}
        >
          How it works
        </Link>

        {variant === "marketing" ? (
          <>
            <Link
              href="/login"
              className="flex h-9 items-center whitespace-nowrap font-record text-[0.72rem] text-soft uppercase tracking-[0.11em] hover:text-ink"
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              className="flex h-9 items-center whitespace-nowrap rounded-hair border border-mark px-4 font-record text-[0.72rem] text-mark uppercase tracking-[0.11em] transition-colors duration-150 ease-out-quart hover:bg-wash"
            >
              {/* Two labels, one control. "Start reading" wrapped to two lines
                  inside a 390px bar, which is how a primary action stops
                  looking like one. */}
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start reading</span>
            </Link>
          </>
        ) : null}

        <ThemeToggle />
      </nav>
    </div>
  </header>
);
