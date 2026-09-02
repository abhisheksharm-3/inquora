import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";
import { AccountMenu } from "./AccountMenu";

/**
 * The bar across every signed-in surface: who this is, where you can go, and
 * you.
 *
 * Three elements, one shape language. What it replaces had four in three: two
 * text links, a bordered "New conversation" button and two round-and-square
 * widgets side by side. The button was the loudest thing on the bar and did
 * nothing on the page it was loudest on, since `/ask` *is* the new
 * conversation — so `Ask` is a destination like any other and the primary
 * action lives on the page, where a primary action belongs.
 *
 * The theme is inside the account menu now. It is a preference, and preferences
 * live with the account rather than as a permanent widget beside the
 * navigation, which is where three earlier versions of it kept going wrong.
 *
 * There is no sidebar. A persistent list of conversations would take the width
 * the reading column needs, and history is a surface of its own that says more
 * about a conversation than a truncated title in a rail can.
 */
export const Chrome = ({
  current,
  account,
}: {
  current: "ask" | "history" | "settings" | "chat";
  account: Account | null;
}) => (
  <header className="col-span-full flex h-16 items-center justify-between gap-4 border-rule border-b px-6 sm:px-7 wide:px-10">
    <Link
      href={DASHBOARD_ROUTES.HOME}
      className="font-reading text-[1.2rem] text-ink tracking-[0.01em]"
    >
      Inquora
    </Link>

    <nav className="flex items-center gap-6 sm:gap-8">
      <Destination href={DASHBOARD_ROUTES.HOME} active={current === "ask" || current === "chat"}>
        Ask
      </Destination>
      <Destination href={DASHBOARD_ROUTES.HISTORY} active={current === "history"}>
        History
      </Destination>

      {account ? <AccountMenu account={account} /> : null}
    </nav>
  </header>
);

/**
 * `prefetch` is left at its default, which in Next 16 prefetches the route's
 * cached shell for links in the viewport. There are two of them and they are
 * always in the viewport, so this is the whole of what "instant" means here.
 */
const Destination = ({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) => (
  <Link
    href={href}
    aria-current={active ? "page" : undefined}
    className={`flex h-9 items-center whitespace-nowrap font-record text-[0.72rem] uppercase tracking-[0.11em] ${
      active ? "text-ink" : "text-soft hover:text-ink"
    }`}
  >
    {children}
  </Link>
);
