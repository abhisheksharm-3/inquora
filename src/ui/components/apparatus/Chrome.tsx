import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";
import { ThemeToggle } from "@/ui/components/shared/ThemeToggle";
import { AccountMenu } from "./AccountMenu";

/**
 * The bar across every signed-in surface, in the order things matter.
 *
 * `New` is first and set as a control rather than as a third link, because
 * starting a conversation is what somebody came to do. `History` is the other
 * place to go. `Settings` is not here: it belongs to the account, so it is in
 * the account menu with the other things that belong to being signed in.
 *
 * There is no sidebar. A persistent list of conversations would take the width
 * the reading column needs, and history is a surface of its own that says more
 * about a conversation than a truncated title in a rail can.
 */
export const Chrome = ({
  current,
  account,
}: {
  current: "choose" | "history" | "settings" | "chat";
  account: Account | null;
}) => (
  <header className="col-span-full flex h-16 items-center justify-between gap-4 border-rule border-b px-6 sm:px-7 wide:px-10">
    <Link
      href={DASHBOARD_ROUTES.HOME}
      className="font-reading text-[1.2rem] text-ink tracking-[0.01em]"
    >
      Inquora
    </Link>

    <nav className="flex items-center gap-4 sm:gap-6">
      <Link
        href={DASHBOARD_ROUTES.HISTORY}
        aria-current={current === "history" ? "page" : undefined}
        className={`flex h-9 items-center whitespace-nowrap font-record text-[0.72rem] uppercase tracking-[0.11em] ${
          current === "history" ? "text-ink" : "text-soft hover:text-ink"
        }`}
      >
        History
      </Link>

      <Link
        href={DASHBOARD_ROUTES.HOME}
        aria-current={current === "choose" ? "page" : undefined}
        className="flex h-9 items-center whitespace-nowrap rounded-hair border border-mark px-4 font-record text-[0.72rem] text-mark uppercase tracking-[0.11em] transition-colors duration-150 ease-out-quart hover:bg-wash"
      >
        <span className="sm:hidden">New</span>
        <span className="hidden sm:inline">New conversation</span>
      </Link>

      {/* The theme and the account are both utilities, so they sit together
            as one cluster. Apart, with equal gaps, a square theme button and a
            round avatar read as two unrelated widgets. */}
      <span className="flex items-center gap-1.5">
        <ThemeToggle className="border-transparent hover:border-rule" />
        {account ? <AccountMenu account={account} /> : null}
      </span>
    </nav>
  </header>
);
