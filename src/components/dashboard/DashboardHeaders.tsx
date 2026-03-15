"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, PanelLeft } from "lucide-react";

import PricingDialog from "./PricingDialog";
import { useSidebarState } from "@/hooks/useMobileSidebarState";
import { useChats } from "@/hooks/useChats";
import { useFileById } from "@/hooks/useFiles";
import { TypeChat, TypeFile } from "@/types/database";
import { ModeToggle } from "@/components/shared/mode-toggle";

/**
 * Displays information about the currently active chat or file in the desktop header.
 * @param {{ chat: TypeChat | null; file: TypeFile | null }} props - Component props.
 */
const ActiveTab = ({
  chat,
  file,
}: {
  chat: TypeChat | null;
  file: TypeFile | null;
}) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2 px-3 shadow-sm">
    <div className="h-full w-1 self-stretch rounded-full bg-primary" />
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">
        {file?.name || chat?.title || "New Chat"}
      </p>
    </div>
    <Badge variant="secondary">
      {file?.type?.toUpperCase() || chat?.type?.toUpperCase() || "DOC"}
    </Badge>
  </div>
);

/**
 * A simple button that links to the page for starting a new chat.
 */
const AddTabButton = () => (
  <Button asChild variant="outline" size="icon">
    <Link href="/choose">
      <Plus className="h-4 w-4" />
    </Link>
  </Button>
);

/**
 * Renders the sticky header for mobile views.
 *
 * Includes the trigger to open the mobile sidebar, the company logo, and an
 * "Upgrade" button.
 */
export const DashboardMobileHeader = () => {
  const { openSidebar } = useSidebarState();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 bg-transparent backdrop-blur-xl md:hidden">
      <Button variant="ghost" size="icon" onClick={openSidebar}>
        <PanelLeft className="h-5 w-5" />
        <span className="sr-only">Open Sidebar</span>
      </Button>
      <PricingDialog
        trigger={
          <Button size="sm" className="cursor-pointer">
            Upgrade
          </Button>
        }
      />
    </header>
  );
};

/**
 * Renders the header for desktop views.
 *
 * It displays the currently active chat tab, a button to add a new chat,
 * and an "Upgrade" button.
 */
export const DashboardDesktopHeader = () => {
  const params = useParams();
  const pathname = usePathname();
  const { getChatById } = useChats();
  const isHistoryPage = pathname === "/history";
  const isChatPage = pathname?.startsWith("/chat/");
  const chatId = isChatPage && params?.id ? params.id.toString() : null;
  const chat = chatId ? getChatById(chatId) : null;
  const { data: file } = useFileById(chat?.file_id || "");

  return (
    <header className="hidden h-16 shrink-0 items-center justify-between px-6 md:flex">
      <div className="flex items-center gap-2">
        {!isHistoryPage && (
          <ActiveTab chat={chat ?? null} file={file || null} />
        )}
        {!isHistoryPage && <AddTabButton />}
      </div>
      <div className="flex items-center gap-3">
        <ModeToggle />
        <PricingDialog
          trigger={
            <Button size="sm">
              Upgrade plan
              <Badge variant="secondary" className="ml-2 bg-muted">
                PRO
              </Badge>
            </Button>
          }
        />
      </div>
    </header>
  );
};
