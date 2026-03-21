import { LucideIcon } from "lucide-react";

export interface TypeSettingsStats {
  totalChats: number;
  totalFiles: number;
  estimatedMessages: number;
  recentChats: number;
  recentFiles: number;
  fileTypes: Record<string, number>;
  accountAge: number;
  mostActiveDay: string;
}

export interface TypeActivityItem {
  id: string;
  type: "chat" | "file";
  title: string;
  timestamp: string;
  icon: LucideIcon;
}

export type TypeSettingsStatsPayload = {
  messageCount: number;
  mostActiveDay: string;
};
