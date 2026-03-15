"use client";
import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import LogoutDialog from "@/components/dashboard/LogoutDialog";
import { NavigationItems } from "@/constants/nav-items";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Renders the primary navigation links for the desktop sidebar.
 *
 * It uses tooltips to show the title of each icon-only link and highlights
 * the active link based on the current URL path.
 *
 * @returns {JSX.Element} The rendered navigation component.
 */
const DesktopNavigation = () => {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || (href === "/choose" && pathname.startsWith("/chat"));

  return (
    <nav className="flex flex-col items-center gap-2">
      {NavigationItems.map(({ href, icon: Icon, title }) => (
        <Tooltip key={href}>
          <TooltipTrigger asChild>
            <Link
              href={href}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive(href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{title}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
};

/**
 * Renders the fixed sidebar for desktop views.
 *
 * This component provides the main navigation structure for the dashboard,
 * including a link to the main dashboard, primary navigation items, and a
 * logout button, all within a compact, icon-only layout with tooltips.
 *
 * @returns {JSX.Element} The rendered desktop sidebar.
 */
export const DashboardDesktopSidebar = () => (
  <aside className="hidden md:flex w-16 flex-col items-center justify-between border-r border-border bg-card/30 py-5 my-3 rounded-xl ml-2 backdrop-blur-md">
    <TooltipProvider delayDuration={0}>
      <Link
        href="/choose"
        className="flex h-10 w-10 items-center justify-center transition-transform hover:scale-110"
      >
        <Image src="/logo.png" alt="Logo" width={32} height={32} priority />
      </Link>
      <DesktopNavigation />
      <Tooltip>
        <LogoutDialog
          trigger={
            <TooltipTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive cursor-pointer">
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
          }
        />
        <TooltipContent side="right">Logout</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </aside>
);
