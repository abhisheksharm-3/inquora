"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronsLeft, Loader2, Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import PricingDialog from "@/components/dashboard/PricingDialog";
import { MobileNavItems } from "@/constants/NavItems";
import { TypeUser } from "@/types/TypeSupabase";
import { useUser } from "@/hooks/useUser";
import avatarImage from "@/assets/images/avatar.svg";
import { useSidebarState } from "@/hooks/useMobileSidebarState";
import { usePathname } from "next/navigation";
import { Badge } from "../ui/badge";
import { useTheme } from "next-themes";

/**
 * Renders the main navigation links within the mobile sidebar.
 *
 * @param {{ onItemClick: () => void }} props - Component props.
 * @param {() => void} props.onItemClick - Function to close the sidebar when an item is clicked.
 * @returns {JSX.Element} The rendered navigation list.
 */
const MobileNavigation = ({ onItemClick }: { onItemClick: () => void }) => {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-4">
      <div className="space-y-2">
        {MobileNavItems.map(({ href, icon: Icon, title, description }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 rounded-lg p-3 transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
              onClick={onItemClick}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-card ${
                  isActive ? "text-primary" : ""
                }`}
              >
                <Icon size={20} />
              </div>
              <div>
                <div className="font-medium text-foreground">{title}</div>
                <div className="text-sm text-muted-foreground">
                  {description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * Displays the current user's profile information in the mobile sidebar.
 *
 * It shows an avatar, name, and email, with a loading state. It also includes
 * a button to upgrade the user's plan.
 *
 * @param {{ user: TypeUser | null | undefined; isLoading: boolean; }} props - Component props.
 * @returns {JSX.Element} The rendered user profile card.
 */
const UserProfile = ({
  user,
  isLoading,
}: {
  user: TypeUser | null | undefined;
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <Image
          src={avatarImage}
          alt="User Avatar"
          width={48}
          height={48}
          className="rounded-full"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">
            {user?.name || "User"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {user?.email || "No email"}
          </p>
        </div>
        <Badge variant="secondary">FREE</Badge>
      </div>
      <PricingDialog trigger={<Button className="w-full">Upgrade to Pro</Button>} />
    </div>
  );
};

/**
 * Theme selector component for the mobile sidebar
 */
const ThemeSelector = () => {
  const { setTheme, theme } = useTheme();
  
  return (
    <div className="px-4 py-3 border-t border-border">
      <p className="text-sm font-medium text-foreground mb-3">Theme</p>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={theme === "light" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("light")}
          className="flex flex-col items-center gap-1 h-auto py-2"
        >
          <Sun className="h-4 w-4" />
          <span className="text-xs">Light</span>
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("dark")}
          className="flex flex-col items-center gap-1 h-auto py-2"
        >
          <Moon className="h-4 w-4" />
          <span className="text-xs">Dark</span>
        </Button>
        <Button
          variant={theme === "system" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("system")}
          className="flex flex-col items-center gap-1 h-auto py-2"
        >
          <Laptop className="h-4 w-4" />
          <span className="text-xs">System</span>
        </Button>
      </div>
    </div>
  );
};

/**
 * Renders the slide-out sidebar for mobile and tablet views.
 *
 * This component includes the main navigation, user profile, and is controlled
 * by a global state hook (`useSidebarState`). It also features a backdrop
 * overlay that closes the sidebar when clicked.
 *
 * @returns {JSX.Element} The rendered mobile sidebar.
 */
export const DashboardMobileSidebar = () => {
  const { user, isLoading } = useUser();
  const { isOpen, closeSidebar } = useSidebarState();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity md:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeSidebar}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-4/5 max-w-sm flex-col bg-background transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <Link href="/choose" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Logo"
              width={28}
              height={28}
              priority
            />
            <span className="font-semibold text-foreground">Inquora</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar}
            className="text-muted-foreground"
          >
            <ChevronsLeft className="h-6 w-6" />
          </Button>
        </div>
        <MobileNavigation onItemClick={closeSidebar} />
        <ThemeSelector />
        <div className="mt-auto p-4 border-t border-border">
          <UserProfile user={user} isLoading={isLoading} />
        </div>
      </aside>
    </>
  );
};