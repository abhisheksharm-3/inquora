"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/hooks/useMessages";
import { useChats } from "@/hooks/useChats";
import { useFileById } from "@/hooks/useFiles";

const REDIRECT_DELAY_MS = 2000;

export const useChatInterface = ({ chatId }: { chatId: string }) => {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [showDocument, setShowDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading: messagesLoading, isSending, sendMessage, subscribeToMessages } = useMessages(chatId);
  const { getChatById } = useChats();
  
  const chat = useMemo(() => getChatById(chatId), [getChatById, chatId]);
  const { data: file, isLoading: isFileLoading, isError: isFileError } = useFileById(chat?.file_id || "");
  
  const { isChatLoading, isChatError } = useMemo(() => ({
    isChatLoading: !chat && messagesLoading,
    isChatError: !chat && !messagesLoading,
  }), [chat, messagesLoading]);

  const handleSendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || inputValue.trim();
    if (!content || isSending) return;

    if (messageContent) {
      setInputValue("");
    }

    try {
      await sendMessage(content);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [inputValue, isSending, sendMessage]);

  useEffect(() => {
    if (!isChatLoading && isChatError) {
      const timer = setTimeout(() => router.push("/not-found"), REDIRECT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isChatError, isChatLoading, router]);

  useEffect(() => {
    const unsubscribe = subscribeToMessages();
    return unsubscribe;
  }, [subscribeToMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      const scrollToBottom = () => {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: "smooth", 
            block: "nearest",
            inline: "nearest"
          });
        });
      };
      
      const timeoutId = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.id]);

  return {
    inputValue,
    setInputValue,
    showDocument,
    setShowDocument,
    localMessages: messages,
    messagesEndRef,
    chat,
    file,
    isChatLoading,
    messagesLoading,
    isFileLoading,
    isFileError,
    isSending,
    handleSendMessage,
  };
};