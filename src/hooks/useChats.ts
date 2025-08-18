"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import { TypeChat, TypeChatWithFile } from "@/types/TypeSupabase";
import { useUser } from "./useUser";
import { createChat as createChatWithFile } from "@/utils/gemini/actions";
import { useState, useCallback } from "react";

/** The base query key for all chat-related queries. */
export const CHATS_QUERY_KEY = ["chats"];

/**
 * A hook for fetching and managing user chats with queries, mutations, and helpers.
 *
 * @param chatId The optional ID of a specific chat to fetch and manage.
 */
export const useChats = (chatId?: string) => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();
  const { userId } = useUser();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- QUERIES ---

  /** Query to fetch the list of all chats for the user. */
  const chatsQuery = useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: async () => {
      if (!userId) return [];
      // Fetch chats with their associated files to avoid N+1 queries
      const { data, error } = await supabase
        .from("chats")
        .select(`
          *,
          files (
            id,
            name,
            type,
            size,
            url,
            uploaded_at
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TypeChatWithFile[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  /** Query to fetch a single chat by its ID. */
  const singleChatQuery = useQuery({
    queryKey: [...CHATS_QUERY_KEY, chatId],
    queryFn: async () => {
      if (!userId || !chatId) return null;
      const { data, error } = await supabase
        .from("chats")
        .select("*, files(*)")
        .eq("id", chatId)
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as TypeChat | null;
    },
    enabled: !!userId && !!chatId,
  });

  // --- MUTATIONS ---

  /** Mutation to create a new chat associated with a file. */
  const startChatWithFileMutation = useMutation({
    mutationFn: (fileId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      return createChatWithFile(fileId, userId);
    },
    onSuccess: (newChat) => {
      queryClient.setQueryData<TypeChatWithFile[]>(CHATS_QUERY_KEY, (old = []) => [newChat, ...old]);
    },
  });

  /** Mutation to update an existing chat. */
  const updateChatMutation = useMutation({
    mutationFn: async ({ chatId: id, chatData }: { chatId: string; chatData: Partial<TypeChat> }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from("chats").update(chatData).eq("id", id).eq("user_id", userId).select().single();
      if (error) throw error;
      return data as TypeChat;
    },
    onSuccess: (updatedChat) => {
      // Update the main list cache
      queryClient.setQueryData<TypeChatWithFile[]>(CHATS_QUERY_KEY, (old = []) =>
        old.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat))
      );
      // Update the specific chat cache
      queryClient.setQueryData([...CHATS_QUERY_KEY, updatedChat.id], updatedChat);
    },
  });

  /** Mutation to delete a chat. */
  const deleteChatMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from("chats").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedChatId) => {
      // Remove from the main list cache
      queryClient.setQueryData<TypeChatWithFile[]>(CHATS_QUERY_KEY, (old = []) =>
        old.filter((chat) => chat.id !== deletedChatId)
      );
      // Invalidate the specific chat query
      queryClient.removeQueries({ queryKey: [...CHATS_QUERY_KEY, deletedChatId] });
    },
  });

  // --- HELPER FUNCTIONS ---

  /** Retrieves a chat from the cache by its ID. */
  const getChatById = useCallback((id: string): TypeChatWithFile | undefined => {
      return chatsQuery.data?.find((chat) => chat.id === id);
    }, [chatsQuery.data]
  );

  /** A wrapper for the delete mutation to handle UI loading state. */
  const handleDeleteChat = useCallback(async (id: string): Promise<void> => {
      setDeletingId(id);
      try {
        await deleteChatMutation.mutateAsync(id);
      } finally {
        setDeletingId(null);
      }
    }, [deleteChatMutation]
  );
  
  // Note: createChat mutation was omitted as it's not present in the final return object.

  return {
    // Queries
    chats: chatsQuery.data || [],
    isLoading: chatsQuery.isLoading,
    isError: chatsQuery.isError,
    error: chatsQuery.error,
    refetch: chatsQuery.refetch,

    chat: singleChatQuery.data,
    isChatLoading: singleChatQuery.isLoading,
    isChatError: singleChatQuery.isError,
    chatError: singleChatQuery.error,
    refetchChat: singleChatQuery.refetch,

    // Helper function
    getChatById,

    // Mutations
    startChatWithFile: startChatWithFileMutation.mutate,
    startChatWithFileAsync: startChatWithFileMutation.mutateAsync,
    isStartingChat: startChatWithFileMutation.isPending,
    startChatError: startChatWithFileMutation.error,

    updateChat: updateChatMutation.mutate,
    updateChatAsync: updateChatMutation.mutateAsync,
    isUpdating: updateChatMutation.isPending,
    updateError: updateChatMutation.error,
    
    deleteChat: deleteChatMutation.mutate,
    deleteChatAsync: deleteChatMutation.mutateAsync,
    isDeleting: deleteChatMutation.isPending,
    deleteError: deleteChatMutation.error,
    
    handleDeleteChat,
    deletingId,
  };
};