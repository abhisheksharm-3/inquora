"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/providers/SupabaseProvider";
import { TypeMessage } from "@/types/database";
import { useUser } from "./useUser";
import { sendMessage as sendMessageToGemini } from "@/utils/gemini/message-actions";
import { useMemo, useCallback, useTransition, useOptimistic } from "react";
import { getSessionMetadata } from "@/utils/session-metadata";
import { createMessageRepository } from "@/data/repositories";
import { QUERY_KEYS, TIMING_CONSTANTS } from "@/config/constants";
import { TypeGeminiMessage } from "@/types/gemini";

const createOptimisticMessages = (chatId: string, content: string) => {
  const timestamp = new Date().toISOString();
  const baseId = Date.now();

  return {
    tempUserMessage: {
      id: `temp-user-${baseId}`,
      chat_id: chatId,
      role: "user" as const,
      content,
      created_at: timestamp,
    },
    tempAiMessage: {
      id: `temp-ai-${baseId}`,
      chat_id: chatId,
      role: "assistant" as const,
      content: "...",
      created_at: timestamp,
    },
  };
};

export const useMessages = (chatId: string) => {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { isAuthenticated, userId } = useUser();
  const [isPending, startTransition] = useTransition();

  const messageRepository = useMemo(
    () => createMessageRepository(supabase),
    [supabase]
  );

  const isValidChatId = !!chatId?.trim();

  const queryKey = useMemo(() => [...QUERY_KEYS.MESSAGES, chatId], [chatId]);

  const messagesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<TypeMessage[]> => {
      if (!isValidChatId) return [];
      return messageRepository.findAllByChatId(chatId);
    },
    enabled: isAuthenticated && isValidChatId,
    staleTime: TIMING_CONSTANTS.STALE_TIME_MS,
    gcTime: TIMING_CONSTANTS.CACHE_TIME_MS,
  });

  const serverMessages = useMemo(
    () => messagesQuery.data || [],
    [messagesQuery.data]
  );

  const optimisticReducer = useCallback(
    (state: TypeMessage[], newMessage: TypeMessage) => {
      if (newMessage.role === "user") {
        return [...state, newMessage];
      }

      if (newMessage.role === "assistant") {
        const existingTempAiIndex = state.findIndex(
          (msg) => msg.role === "assistant" && msg.id.startsWith("temp-ai-"),
        );

        if (existingTempAiIndex !== -1) {
          const newState = [...state];
          newState[existingTempAiIndex] = newMessage;
          return newState;
        }
        return [...state, newMessage];
      }

      return [...state, newMessage];
    },
    [],
  );

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    serverMessages,
    optimisticReducer,
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!isValidChatId) throw new Error("No chat ID provided");
      if (!userId) throw new Error("No authenticated user");
      if (!content.trim()) return;

      const { tempUserMessage, tempAiMessage } = createOptimisticMessages(
        chatId,
        content,
      );

      startTransition(() => {
        addOptimisticMessage(tempUserMessage);
        addOptimisticMessage(tempAiMessage);
      });

      try {
        const currentMessages = serverMessages.filter(
          (msg) => !msg.id.startsWith("temp-") && msg.content !== "...",
        );

        const formattedMessages: TypeGeminiMessage[] =
          currentMessages.map((msg) => ({
            role: msg.role === "user" ? "user" : "model",
            content: msg.content,
          }));

        const sessionMetadata = getSessionMetadata();
        await sendMessageToGemini(chatId, content, formattedMessages, sessionMetadata);

        await queryClient.invalidateQueries({
          queryKey,
          exact: true,
        });
      } catch (error) {
        console.error("Send message error:", error);

        startTransition(() => {
          const errorMessage: TypeMessage = {
            id: `error-${Date.now()}`,
            chat_id: chatId,
            role: "assistant",
            content:
              "Sorry, there was an error processing your request. Please try again.",
            created_at: new Date().toISOString(),
          };

          addOptimisticMessage(errorMessage);
        });
      }
    },
    [
      isValidChatId,
      userId,
      chatId,
      addOptimisticMessage,
      startTransition,
      serverMessages,
      queryClient,
      queryKey,
    ],
  );

  const createMessageMutation = useMutation({
    mutationFn: async (
      messageData: Omit<TypeMessage, "id" | "created_at">,
    ): Promise<TypeMessage> => {
      if (!isValidChatId) throw new Error("No chat ID provided");
      return messageRepository.create(messageData);
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData<TypeMessage[]>(queryKey, (oldData = []) => [
        ...oldData,
        newMessage,
      ]);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string): Promise<string> => {
      if (!isValidChatId) throw new Error("No chat ID provided");
      await messageRepository.delete(messageId);
      return messageId;
    },
    onSuccess: (deletedMessageId) => {
      queryClient.setQueryData<TypeMessage[]>(queryKey, (oldData = []) =>
        oldData.filter((msg) => msg.id !== deletedMessageId),
      );
    },
  });

  const subscribeToMessages = useCallback(() => {
    if (!isValidChatId || !isAuthenticated) return () => { };

    const channel = supabase.channel(`messages:${chatId}`);

    channel
      .on<TypeMessage>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          queryClient.setQueryData<TypeMessage[]>(queryKey, (oldData = []) => {
            if (payload.eventType === "INSERT") {
              const newMessage = payload.new as TypeMessage;
              return oldData.some((msg) => msg.id === newMessage.id)
                ? oldData
                : [...oldData, newMessage];
            }
            if (payload.eventType === "UPDATE") {
              const updatedMessage = payload.new as TypeMessage;
              return oldData.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg,
              );
            }
            if (payload.eventType === "DELETE") {
              const deletedMessageId = (payload.old as { id: string }).id;
              return oldData.filter((msg) => msg.id !== deletedMessageId);
            }
            return oldData;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isValidChatId, isAuthenticated, chatId, queryClient, supabase, queryKey]);

  return {
    messages: optimisticMessages,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,

    sendMessage,
    isSending: isPending,

    createMessage: createMessageMutation.mutate,
    createMessageAsync: createMessageMutation.mutateAsync,
    isCreating: createMessageMutation.isPending,

    deleteMessage: deleteMessageMutation.mutate,
    deleteMessageAsync: deleteMessageMutation.mutateAsync,
    isDeleting: deleteMessageMutation.isPending,

    subscribeToMessages,
  };
};
