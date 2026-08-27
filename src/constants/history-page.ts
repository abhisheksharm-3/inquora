import { TypeDropdownAction } from "@/types/ui";
import { Download, Send, Trash2 } from "lucide-react";

/**
 * An array of configuration objects for actions in a dropdown menu on the history page.
 *
 * Each object defines an action with its icon, display label, and an event handler.
 */
export const HistoryPageDropdownActions: TypeDropdownAction[] = [
  {
    icon: Download,
    label: "Download file",
    handler: (e, chat, file) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Download file:", file?.name);
    },
  },
  {
    icon: Send,
    label: "Share file",
    handler: (e, chat, file) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Share file:", file?.name);
    },
  },
  {
    icon: Trash2,
    label: "Delete",
    handler: (e, chat) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Delete chat:", chat.id);
    },
  },
];

/**
 * A placeholder array used for rendering skeleton loaders on the history page.
 * This provides a set number of items to loop over while data is loading.
 */
export const HistoryPageSkeletonItems = Array.from({ length: 3 }, (_, index) => ({ id: index }));

/**
 * An object containing Tailwind CSS class configurations for various skeleton loader elements.
 * Updated for improved responsive design and cohesive styling.
 */
export const HistoryPageSkeletonConfigs = {
  title: { height: "h-4", width: "w-32 sm:w-48 lg:w-56" },
  badge: { height: "h-5", width: "w-12 sm:w-14" },
  mobileSize: { height: "h-3", width: "w-12" },
  mobileTime: { height: "h-3", width: "w-16" },
  desktopSize: { height: "h-3", width: "w-14" },
  desktopTime: { height: "h-3", width: "w-20" },
} as const;
