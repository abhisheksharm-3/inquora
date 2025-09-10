"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import { TypeChat, TypeChatWithFile } from "@/types/TypeSupabase";
import { useUser } from "./useUser";
import { createChat as createChatWithFile } from "@/utils/gemini/actions";
import { useState, useCallback, useMemo } from "react";

export const CHATS_QUERY_KEY = ["chats"];

export const useChats = (chatId?: string) => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();
  const { userId } = useUser();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const chatsQuery = useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: async (): Promise<TypeChatWithFile[]> => {
      if (!userId) return [];

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
      return data as TypeChatWithFile[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const singleChatQuery = useQuery({
    queryKey: [...CHATS_QUERY_KEY, chatId],
    queryFn: async (): Promise<TypeChat | null> => {
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

  const startChatWithFileMutation = useMutation({
    mutationFn: (fileId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      return createChatWithFile(fileId, userId);
    },
    onSuccess: (newChat) => {
      queryClient.setQueryData<TypeChatWithFile[]>(
        CHATS_QUERY_KEY,
        (old = []) => [newChat, ...old],
      );
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({
      chatId: id,
      chatData,
    }: {
      chatId: string;
      chatData: Partial<TypeChat>;
    }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from("chats")
        .update(chatData)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data as TypeChat;
    },
    onSuccess: (updatedChat) => {
      queryClient.setQueryData<TypeChatWithFile[]>(
        CHATS_QUERY_KEY,
        (old = []) =>
          old.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat)),
      );
      queryClient.setQueryData(
        [...CHATS_QUERY_KEY, updatedChat.id],
        updatedChat,
      );
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedChatId) => {
      queryClient.setQueryData<TypeChatWithFile[]>(
        CHATS_QUERY_KEY,
        (old = []) => old.filter((chat) => chat.id !== deletedChatId),
      );
      queryClient.removeQueries({
        queryKey: [...CHATS_QUERY_KEY, deletedChatId],
      });
    },
  });

  const getChatById = useCallback(
    (id: string): TypeChatWithFile | undefined => {
      return chatsQuery.data?.find((chat) => chat.id === id);
    },
    [chatsQuery.data],
  );

  const handleDeleteChat = useCallback(
    async (id: string): Promise<void> => {
      setDeletingId(id);
      try {
        await deleteChatMutation.mutateAsync(id);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteChatMutation],
  );

  return useMemo(
    () => ({
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

      getChatById,

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
    }),
    [
      chatsQuery.data,
      chatsQuery.isLoading,
      chatsQuery.isError,
      chatsQuery.error,
      chatsQuery.refetch,
      singleChatQuery.data,
      singleChatQuery.isLoading,
      singleChatQuery.isError,
      singleChatQuery.error,
      singleChatQuery.refetch,
      getChatById,
      startChatWithFileMutation.mutate,
      startChatWithFileMutation.mutateAsync,
      startChatWithFileMutation.isPending,
      startChatWithFileMutation.error,
      updateChatMutation.mutate,
      updateChatMutation.mutateAsync,
      updateChatMutation.isPending,
      updateChatMutation.error,
      deleteChatMutation.mutate,
      deleteChatMutation.mutateAsync,
      deleteChatMutation.isPending,
      deleteChatMutation.error,
      handleDeleteChat,
      deletingId,
    ],
  );
};
