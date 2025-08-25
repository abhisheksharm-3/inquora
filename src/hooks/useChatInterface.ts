"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/hooks/useMessages";
import { useChats } from "@/hooks/useChats";
import { useFileById } from "@/hooks/useFiles";
import { checkYouTubeProcessingError, createYouTubeErrorMessage } from "@/utils/message-utils";

const REDIRECT_DELAY_MS = 2000;

/**
 * Manages all state and logic for the chat interface.
 */
export const useChatInterface = ({ chatId }: { chatId: string }) => {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [showDocument, setShowDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Core Data Hooks ---
  const { messages, isLoading: messagesLoading, isSending, sendMessage, subscribeToMessages } = useMessages(chatId);
  const { getChatById } = useChats();
  
  // --- Derived State ---
  const chat = getChatById(chatId);
  const { data: file, isLoading: isFileLoading, isError: isFileError } = useFileById(chat?.file_id || "");
  
  const isChatLoading = !chat && messagesLoading;
  const isChatError = !chat && !messagesLoading;

  // --- Handlers ---
  const handleSendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || inputValue.trim();
    if (!content || isSending) return;

    // Clear input if message content was passed directly (from ChatInterfaceInput)
    if (messageContent) {
      setInputValue("");
    }

    try {
      await sendMessage(content);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [inputValue, isSending, sendMessage]);

  // --- Effects ---
  useEffect(() => {
    if (!isChatLoading && isChatError) {
      const timer = setTimeout(() => router.push("/not-found"), REDIRECT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isChatError, isChatLoading, router]);

  // Separate effect for subscription
  useEffect(() => {
    const unsubscribe = subscribeToMessages();
    return unsubscribe;
  }, [subscribeToMessages]);

  // Separate effect for scrolling - scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM is fully updated
      const scrollToBottom = () => {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: "smooth", 
            block: "nearest",
            inline: "nearest"
          });
        });
      };
      
      // Small delay to ensure all DOM updates are complete
      const timeoutId = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.id]);

  return {
    // State
    inputValue,
    setInputValue,
    showDocument,
    setShowDocument,
    localMessages: messages, // Use messages from useMessages hook with React 19 optimistic updates
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