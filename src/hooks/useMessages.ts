"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import { TypeMessage } from "@/types/TypeSupabase";
import { useUser } from "./useUser";
import { sendMessage as sendMessageToGemini } from "@/utils/gemini/actions";
import { useMemo, useCallback, useTransition, useOptimistic } from "react";

/** The base query key for all message-related queries. */
export const MESSAGES_QUERY_KEY = ["messages"];

// --- Optimistic Update Helpers for sendMessage ---

/**
 * Creates temporary messages for optimistic UI updates.
 * @private
 */
const _createOptimisticMessages = (chatId: string, content: string) => {
  const timestamp = new Date().toISOString();
  const tempUserMessage: TypeMessage = {
    id: `temp-user-${Date.now()}`,
    chat_id: chatId,
    role: "user",
    content,
    created_at: timestamp,
  };
  const tempAiMessage: TypeMessage = {
    id: `temp-ai-${Date.now()}`,
    chat_id: chatId,
    role: "assistant",
    content: "...",
    created_at: timestamp,
  };
  return { tempUserMessage, tempAiMessage };
};

/**
 * A custom hook for fetching and managing messages within a specific chat session.
 *
 * It handles fetching, real-time updates via subscriptions, and mutations for sending,
 * creating, updating, and deleting messages. It features optimistic UI updates for a
 * responsive user experience.
 *
 * @param chatId The ID of the chat to manage messages for.
 */
export const useMessages = (chatId: string) => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();
  const { isAuthenticated, userId } = useUser();
  const [isPending, startTransition] = useTransition();

  const isValidChatId =
    !!chatId && typeof chatId === "string" && chatId.trim() !== "";

  const queryKey = useMemo(() => [...MESSAGES_QUERY_KEY, chatId], [chatId]);

  /** Query to fetch all messages for the specified chat. */
  const messagesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!isValidChatId) return [];
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data as TypeMessage[];
      } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
      }
    },
    enabled: isAuthenticated && isValidChatId,
  });

  // Base messages from server
  const serverMessages = useMemo(() => {
    return messagesQuery.data || [];
  }, [messagesQuery.data]);

  // Use React 19's useOptimistic for optimistic updates
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    serverMessages,
    (state: TypeMessage[], newMessage: TypeMessage) => {
      // If it's a user message, just add it
      if (newMessage.role === "user") {
        return [...state, newMessage];
      }
      
      // If it's an AI message, check if we need to replace an existing temp AI message
      if (newMessage.role === "assistant") {
        const existingTempAiIndex = state.findIndex(msg => 
          msg.role === "assistant" && msg.id.startsWith("temp-ai-")
        );
        
        if (existingTempAiIndex !== -1) {
          // Replace the existing temp AI message
          const newState = [...state];
          newState[existingTempAiIndex] = newMessage;
          return newState;
        } else {
          // Add new AI message
          return [...state, newMessage];
        }
      }
      
      return [...state, newMessage];
    }
  );

  const messages = optimisticMessages;

  /** Simplified send message function using React 19 hooks */
  const sendMessage = useCallback(async (content: string) => {
    if (!isValidChatId) throw new Error("No chat ID provided");
    if (!userId) throw new Error("No authenticated user");
    if (!content.trim()) return;

    // Create optimistic messages
    const { tempUserMessage, tempAiMessage } = _createOptimisticMessages(chatId, content);
    
    // Wrap optimistic updates in startTransition
    startTransition(() => {
      // Add user message optimistically
      addOptimisticMessage(tempUserMessage);
      
      // Add AI thinking message optimistically
      addOptimisticMessage(tempAiMessage);
    });

    try {
      // Convert current server messages to ChatMessage format for Gemini
      const currentMessages = serverMessages.filter(
        (msg) => !msg.id.startsWith("temp-") && msg.content !== "...",
      );
      const formattedMessages: { role: "user" | "model"; content: string }[] = currentMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        content: msg.content,
      }));

      // Send to AI backend
      await sendMessageToGemini(chatId, content, formattedMessages);
      
      // Invalidate queries to fetch fresh data
      await queryClient.invalidateQueries({
        queryKey,
        exact: true,
      });
    } catch (error) {
      console.error("Send message error:", error);
      
      // Create error message and wrap in transition
      startTransition(() => {
        const errorMessage: TypeMessage = {
          id: `error-${Date.now()}`,
          chat_id: chatId,
          role: "assistant",
          content: "Sorry, there was an error processing your request. Please try again.",
          created_at: new Date().toISOString(),
        };
        
        // Replace AI thinking message with error
        addOptimisticMessage(errorMessage);
      });
    }
  }, [isValidChatId, userId, chatId, addOptimisticMessage, startTransition, serverMessages, queryClient, queryKey]);

  /** Mutation to create a message directly in the database. */
  const createMessageMutation = useMutation({
    mutationFn: async (messageData: Omit<TypeMessage, "id" | "created_at">): Promise<TypeMessage> => {
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
        oldData.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
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
        oldData.filter((msg) => msg.id !== deletedMessageId)
      );
    },
  });

  /** Sets up a real-time subscription to keep messages in sync. */
  const subscribeToMessages = useCallback(() => {
    if (!isValidChatId || !isAuthenticated) return () => {};

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
    // Queries - using optimistic messages
    messages,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,

    // Send message using React 19 hooks
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

    // Real-time subscription
    subscribeToMessages,
  };
};