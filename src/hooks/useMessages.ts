"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import { TypeMessage } from "@/types/TypeSupabase";
import { useUser } from "./useUser";
import { sendMessage as sendMessageToGemini } from "@/utils/gemini/actions";
import { useMemo, useCallback, useTransition, useOptimistic } from "react";
import { getSessionMetadata } from "@/utils/session-metadata";

export const MESSAGES_QUERY_KEY = ["messages"];

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
  const supabase = supabaseBrowserClient();
  const { isAuthenticated, userId } = useUser();
  const [isPending, startTransition] = useTransition();

  const isValidChatId = useMemo(
    () => !!chatId && typeof chatId === "string" && chatId.trim() !== "",
    [chatId],
  );

  const queryKey = useMemo(() => [...MESSAGES_QUERY_KEY, chatId], [chatId]);

  const messagesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<TypeMessage[]> => {
      if (!isValidChatId) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return [];
      }

      return data as TypeMessage[];
    },
    enabled: isAuthenticated && isValidChatId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Wrap in useMemo to prevent dependency changes on every render
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

        const formattedMessages: { role: "user" | "model"; content: string }[] =
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

  /** Mutation to create a message directly in the database. */
  const createMessageMutation = useMutation({
    mutationFn: async (
      messageData: Omit<TypeMessage, "id" | "created_at">,
    ): Promise<TypeMessage> => {
      if (!isValidChatId) throw new Error("No chat ID provided");
      const { data, error } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();
      if (error) throw error;
      return data as TypeMessage;
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData<TypeMessage[]>(queryKey, (oldData = []) => [
        ...oldData,
        newMessage,
      ]);
    },
  });

  /** Mutation to update an existing message. */
  const updateMessageMutation = useMutation({
    mutationFn: async ({
      messageId,
      messageData,
    }: {
      messageId: string;
      messageData: Partial<TypeMessage>;
    }): Promise<TypeMessage> => {
      if (!isValidChatId) throw new Error("No chat ID provided");
      const { data, error } = await supabase
        .from("messages")
        .update(messageData)
        .eq("id", messageId)
        .eq("chat_id", chatId)
        .select()
        .single();
      if (error) throw error;
      return data as TypeMessage;
    },
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData<TypeMessage[]>(queryKey, (oldData = []) =>
        oldData.map((msg) =>
          msg.id === updatedMessage.id ? updatedMessage : msg,
        ),
      );
    },
  });

  /** Mutation to delete a message. */
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string): Promise<string> => {
      if (!isValidChatId) throw new Error("No chat ID provided");
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("chat_id", chatId);
      if (error) throw error;
      return messageId;
    },
    onSuccess: (deletedMessageId) => {
      queryClient.setQueryData<TypeMessage[]>(queryKey, (oldData = []) =>
        oldData.filter((msg) => msg.id !== deletedMessageId),
      );
    },
  });

  /** Sets up a real-time subscription to keep messages in sync. */
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

    updateMessage: updateMessageMutation.mutate,
    updateMessageAsync: updateMessageMutation.mutateAsync,
    isUpdating: updateMessageMutation.isPending,

    deleteMessage: deleteMessageMutation.mutate,
    deleteMessageAsync: deleteMessageMutation.mutateAsync,
    isDeleting: deleteMessageMutation.isPending,

    subscribeToMessages,
  };
};
