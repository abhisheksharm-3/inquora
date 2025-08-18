"use client";

import { useEffect, useRef, useCallback, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/hooks/useMessages";
import { useChats } from "@/hooks/useChats";
import { useFileById } from "@/hooks/useFiles";
import { checkYouTubeProcessingError, createErrorMessage, createOptimisticMessages, createYouTubeErrorMessage } from "@/utils/message-utils";
import { chatInterfaceReducer, initialChatInterfaceState } from "@/utils/chat-utils";

const REDIRECT_DELAY_MS = 2000;

/**
 * Manages all state and logic for the chat interface.
 */
export const useChatInterface = ({ chatId }: { chatId: string }) => {
  const router = useRouter();
  const [state, dispatch] = useReducer(chatInterfaceReducer, initialChatInterfaceState);
  const { inputValue, localMessages, showDocument } = state;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Core Data Hooks ---
  const { messages: serverMessages, isLoading: messagesLoading, isSending, sendMessage, subscribeToMessages } = useMessages(chatId);
  const { getChatById } = useChats(); // Fixed: use getChatById instead
  
  // --- Derived State ---
  const chat = getChatById(chatId); // Fixed: call getChatById
  const { data: file, isLoading: isFileLoading, isError: isFileError } = useFileById(chat?.file_id || ""); // Fixed: use file_id
  
  const isChatLoading = !chat && messagesLoading;
  const isChatError = !chat && !messagesLoading;

  // --- Handlers ---
  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isSending) return;

    const { tempUserMessage, tempAiMessage } = createOptimisticMessages(chatId, trimmedInput);
    dispatch({ type: 'SEND_MESSAGE_START', payload: { tempUserMessage, tempAiMessage } });

    try {
      await sendMessage(trimmedInput);
      dispatch({ type: 'SEND_MESSAGE_SUCCESS' });
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = createErrorMessage(chatId);
      dispatch({ type: 'SEND_MESSAGE_ERROR', payload: { tempUserMessage, tempAiMessage, errorMessage } });
    }
  }, [inputValue, isSending, chatId, sendMessage]);

  const setInputValue = (value: string) => dispatch({ type: 'SET_INPUT_VALUE', payload: value });
  const setShowDocument = (show: boolean) => dispatch({ type: 'SET_SHOW_DOCUMENT', payload: show });

  // --- Effects ---
  useEffect(() => {
    if (!isChatLoading && isChatError) {
      const timer = setTimeout(() => router.push("/not-found"), REDIRECT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isChatError, isChatLoading, router]);

  useEffect(() => {
    if (serverMessages) {
      dispatch({ type: 'SYNC_MESSAGES', payload: serverMessages });
    }
  }, [serverMessages]);

  useEffect(() => {
    if (!file || localMessages.length > 0) return;
    
    if (checkYouTubeProcessingError(file)) {
      const errorMessage = createYouTubeErrorMessage(chatId, file);
      dispatch({ type: 'ADD_INITIAL_ERROR', payload: errorMessage });
    }
  }, [file, chatId, localMessages.length]);

  useEffect(() => {
    const unsubscribe = subscribeToMessages();
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    return unsubscribe;
  }, [subscribeToMessages, localMessages]);

  return {
    // State
    inputValue,
    setInputValue,
    showDocument,
    setShowDocument,
    localMessages,
    messagesEndRef,
    // Derived State
    chat,
    file,
    isChatLoading,
    messagesLoading,
    isFileLoading,
    isFileError,
    isSending,
    // Handlers
    handleSendMessage,
  };
};