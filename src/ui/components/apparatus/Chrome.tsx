import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/core/routes";
import { ThemeChoice } from "@/ui/components/shared/ThemeChoice";

/**
 * The one piece of chrome the product has: a wordmark, three destinations and
 * the theme choice, on a hairline rule spanning both columns.
 *
 * There is no sidebar. A persistent list of conversations would occupy the
 * width the reading column needs, and history is a surface of its own that says
 * more about a conversation than a truncated title in a rail can.
 */
export const Chrome = ({ current }: { current: "choose" | "history" | "settings" | "chat" }) => (
  <header className="col-span-full flex items-center justify-between gap-6 border-rule border-b px-6 py-4 wide:px-8">
    <Link
      href={DASHBOARD_ROUTES.HOME}
      className="font-reading text-[1rem] text-ink tracking-[0.02em]"
    >
      Inquora
    </Link>

    <nav className="flex items-center gap-5 font-record text-label text-faint uppercase tracking-[0.14em]">
      <Destination href={DASHBOARD_ROUTES.CHOOSE} active={current === "choose"}>
        New
      </Destination>
      <Destination href={DASHBOARD_ROUTES.HISTORY} active={current === "history"}>
        History
      </Destination>
      <Destination href={DASHBOARD_ROUTES.SETTINGS} active={current === "settings"}>
        Settings
      </Destination>
      <ThemeChoice />
    </nav>
  </header>
);

/**
 * `prefetch` is left at its default, which in Next 16 prefetches the route's
 * cached shell for links in the viewport. There are three of them and they are
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
    className={
      active
        ? "border-mark border-b pb-0.5 text-ink"
        : "border-transparent border-b pb-0.5 hover:text-ink"
    }
  >
    {children}
  </Link>
);
