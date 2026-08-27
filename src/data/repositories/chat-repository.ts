/**
 * Chat repository for database operations.
 * Provides a clean abstraction layer over Supabase for chat-related queries.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { TypeChat, TypeChatWithFile, TypeDatabase } from "@/types/database";

export type ChatRepository = ReturnType<typeof createChatRepository>;

export function createChatRepository(supabase: SupabaseClient<TypeDatabase>) {
  return {
    /**
     * Fetches all chats for a user with associated file data.
     */
    async findAllByUserId(userId: string): Promise<TypeChatWithFile[]> {
      const { data, error } = await supabase
        .from("chats")
        .select(
          `
          *,
          files (
            id,
            name,
            type,
            size,
            url,
            uploaded_at
          )
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TypeChatWithFile[];
    },

    /**
     * Fetches a single chat by ID with file data.
     */
    async findById(chatId: string): Promise<TypeChatWithFile | null> {
      const { data, error } = await supabase
        .from("chats")
        .select(
          `
          *,
          files (
            id,
            name,
            type,
            size,
            url,
            uploaded_at
          )
        `,
        )
        .eq("id", chatId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as TypeChatWithFile;
    },

    /**
     * Creates a new chat.
     */
    async create(chat: Omit<TypeChat, "id" | "created_at" | "updated_at">): Promise<TypeChat> {
      const { data, error } = await supabase.from("chats").insert(chat).select().single();

      if (error) throw error;
      return data;
    },

    /**
     * Updates an existing chat.
     */
    async update(chatId: string, updates: Partial<TypeChat>): Promise<TypeChat> {
      const { data, error } = await supabase
        .from("chats")
        .update(updates)
        .eq("id", chatId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Deletes a chat by ID.
     */
    async delete(chatId: string): Promise<void> {
      const { error } = await supabase.from("chats").delete().eq("id", chatId);

      if (error) throw error;
    },
  };
}
