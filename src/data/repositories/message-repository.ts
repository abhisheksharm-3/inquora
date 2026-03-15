/**
 * Message repository for database operations.
 * Provides a clean abstraction layer over Supabase for message-related queries.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { TypeMessage, TypeDatabase } from "@/types/database";

export type MessageRepository = ReturnType<typeof createMessageRepository>;

export function createMessageRepository(supabase: SupabaseClient<TypeDatabase>) {
    return {
        /**
         * Fetches all messages for a chat.
         */
        async findAllByChatId(chatId: string): Promise<TypeMessage[]> {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: true });

            if (error) throw error;
            return data as TypeMessage[];
        },

        /**
         * Fetches recent messages for a chat with limit.
         */
        async findRecentByChatId(chatId: string, limit: number = 50): Promise<TypeMessage[]> {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).reverse() as TypeMessage[];
        },

        /**
         * Creates a new message.
         */
        async create(message: Omit<TypeMessage, "id" | "created_at">): Promise<TypeMessage> {
            const { data, error } = await supabase
                .from("messages")
                .insert(message)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        /**
         * Creates multiple messages in a batch.
         */
        async createMany(messages: Omit<TypeMessage, "id" | "created_at">[]): Promise<TypeMessage[]> {
            const { data, error } = await supabase
                .from("messages")
                .insert(messages)
                .select();

            if (error) throw error;
            return data;
        },

        /**
         * Deletes all messages for a chat.
         */
        async deleteAllByChatId(chatId: string): Promise<void> {
            const { error } = await supabase
                .from("messages")
                .delete()
                .eq("chat_id", chatId);

            if (error) throw error;
        },

        /**
         * Counts total messages across the given chat IDs.
         */
        async countByChatIds(chatIds: string[]): Promise<number> {
            if (chatIds.length === 0) return 0;
            const { count, error } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .in("chat_id", chatIds);
            if (error) throw error;
            return count ?? 0;
        },
    };
}
