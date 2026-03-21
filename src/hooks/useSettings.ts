"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { useChats } from "./useChats";
import { useFiles } from "./useFiles";
import { getSettingsStats } from "@/app/(dashboard)/settings/actions";
import { MessageSquare, FileText } from "lucide-react";
import { QUERY_KEYS } from "@/config/constants";
import { TypeSettingsStats, TypeActivityItem } from "@/types/settings";

export function useSettings() {
    const { user, avatarUrl, isLoading: userLoading } = useUser();
    const { chats, isLoading: chatsLoading } = useChats();
    const { files, isLoading: filesLoading } = useFiles();
    const { data: serverStats, isLoading: serverStatsLoading } = useQuery({
        queryKey: [...QUERY_KEYS.USER, "settings-stats"],
        queryFn: getSettingsStats,
        enabled: !!user?.id && !userLoading,
    });

    const isLoading = userLoading || chatsLoading || filesLoading || serverStatsLoading;

    const stats = useMemo((): TypeSettingsStats | null => {
        if (chatsLoading || filesLoading) return null;

        const totalChats = chats.length;
        const totalFiles = files.length;
        const messageCount = serverStats?.messageCount ?? 0;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentChats = chats.filter(
            (chat) => new Date(chat.created_at) > sevenDaysAgo
        ).length;

        const recentFiles = files.filter(
            (file) => new Date(file.uploaded_at) > sevenDaysAgo
        ).length;

        const fileTypes = files.reduce(
            (acc, file) => {
                const type = file.type || "unknown";
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        const accountAge = user?.created_at
            ? Math.floor(
                (new Date().getTime() - new Date(user.created_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )
            : 0;

        return {
            totalChats,
            totalFiles,
            estimatedMessages: messageCount,
            recentChats,
            recentFiles,
            fileTypes,
            accountAge,
            mostActiveDay: serverStats?.mostActiveDay ?? "—",
        };
    }, [chats, files, chatsLoading, filesLoading, user, serverStats]);

    const recentActivity = useMemo((): TypeActivityItem[] => {
        if (chatsLoading || filesLoading) return [];

        const activities: TypeActivityItem[] = [
            ...chats.slice(0, 3).map((chat) => ({
                id: chat.id,
                type: "chat" as const,
                title: chat.title || "New Chat",
                timestamp: chat.created_at,
                icon: MessageSquare,
            })),
            ...files.slice(0, 3).map((file) => ({
                id: file.id,
                type: "file" as const,
                title: file.name,
                timestamp: file.uploaded_at,
                icon: FileText,
            })),
        ];

        const sorted = [...activities].sort(
            (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return sorted.slice(0, 5);
    }, [chats, files, chatsLoading, filesLoading]);

    return {
        user,
        avatarUrl,
        stats,
        recentActivity,
        isLoading,
        chatsLoading,
        filesLoading,
    };
}
