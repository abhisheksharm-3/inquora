"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/providers/SupabaseProvider";
import { TypeChat, TypeChatWithFile } from "@/types/database";
import { useUser } from "./useUser";
import { createChat as createChatWithFile } from "@/utils/gemini/actions";
import { useState, useCallback, useMemo } from "react";
import { createChatRepository } from "@/data/repositories";
import { QUERY_KEYS, TIMING_CONSTANTS } from "@/config/constants";

interface UpdateChatParams {
  chatId: string;
  chatData: Partial<TypeChat>;
}

export const useChats = (chatId?: string) => {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { userId } = useUser();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const chatRepository = useMemo(
    () => createChatRepository(supabase),
    [supabase]
  );

  const chatsQuery = useQuery({
    queryKey: QUERY_KEYS.CHATS,
    queryFn: async (): Promise<TypeChatWithFile[]> => {
      if (!userId) return [];
      return chatRepository.findAllByUserId(userId);
    },
    enabled: !!userId,
    staleTime: TIMING_CONSTANTS.CACHE_TIME_MS,
    gcTime: TIMING_CONSTANTS.CACHE_TIME_MS * 2,
  });

  const singleChatQuery = useQuery({
    queryKey: [...QUERY_KEYS.CHATS, chatId],
    queryFn: async (): Promise<TypeChatWithFile | null> => {
      if (!userId || !chatId) return null;
      return chatRepository.findById(chatId);
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
        QUERY_KEYS.CHATS,
        (old = []) => [newChat, ...old],
      );
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({ chatId: id, chatData }: UpdateChatParams) => {
      if (!userId) throw new Error("User not authenticated.");
      return chatRepository.update(id, chatData);
    },
    onSuccess: (updatedChat) => {
      queryClient.setQueryData<TypeChatWithFile[]>(
        QUERY_KEYS.CHATS,
        (old = []) =>
          old.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat)),
      );
      queryClient.setQueryData(
        [...QUERY_KEYS.CHATS, updatedChat.id],
        updatedChat,
      );
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      await chatRepository.delete(id);
      return id;
    },
    onSuccess: (deletedChatId) => {
      queryClient.setQueryData<TypeChatWithFile[]>(
        QUERY_KEYS.CHATS,
        (old = []) => old.filter((chat) => chat.id !== deletedChatId),
      );
      queryClient.removeQueries({
        queryKey: [...QUERY_KEYS.CHATS, deletedChatId],
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
