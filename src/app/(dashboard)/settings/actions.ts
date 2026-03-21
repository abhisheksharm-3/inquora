"use server";

import { supabaseServerClient } from "@/data/supabase/server";
import { createMessageRepository } from "@/data/repositories/message-repository";
import { createChatRepository } from "@/data/repositories/chat-repository";
import { TypeSettingsStatsPayload } from "@/types/settings";

export async function getSettingsStats(): Promise<TypeSettingsStatsPayload | null> {
    const supabase = await supabaseServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const chatRepo = createChatRepository(supabase);
    const messageRepo = createMessageRepository(supabase);
    const chats = await chatRepo.findAllByUserId(user.id);
    const chatIds = chats.map((c) => c.id);
    const messageCount = await messageRepo.countByChatIds(chatIds);

    const dayCounts = new Map<string, number>();
    for (const chat of chats) {
        const day = new Date(chat.created_at).toDateString();
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
    let mostActiveDay = "Today";
    let maxCount = 0;
    const today = new Date().toDateString();
    for (const [day, count] of dayCounts) {
        if (count > maxCount) {
            maxCount = count;
            mostActiveDay = day === today ? "Today" : new Date(day).toLocaleDateString("en-US", { weekday: "long" });
        }
    }

    return { messageCount, mostActiveDay };
}
