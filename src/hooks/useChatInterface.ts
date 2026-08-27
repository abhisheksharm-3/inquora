"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/hooks/useMessages";
import { useChats } from "@/hooks/useChats";
import { useFileById } from "@/hooks/useFiles";
import { VersionConfig } from "@/constants/version-config";

const REDIRECT_DELAY_MS = 2000;

export const useChatInterface = ({ chatId }: { chatId: string }) => {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [showDocument, setShowDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading: messagesLoading,
    isError: isMessagesError,
    isSending,
    sendMessage,
    subscribeToMessages,
  } = useMessages(chatId);
  const { getChatById } = useChats();

  const chat = useMemo(() => getChatById(chatId), [getChatById, chatId]);
  const {
    data: file,
    isLoading: isFileLoading,
    isError: isFileError,
  } = useFileById(chat?.file_id || "");

  const { isChatLoading, isChatError } = useMemo(
    () => ({
      isChatLoading: !chat && messagesLoading,
      isChatError: !chat && !messagesLoading && isMessagesError,
    }),
    [chat, messagesLoading, isMessagesError],
  );

  const handleSendMessage = useCallback(
    async (messageContent?: string) => {
      const content = messageContent ?? inputValue.trim();
      if (!content || isSending) return;

      setInputValue("");

      try {
        await sendMessage(content);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [inputValue, isSending, sendMessage],
  );

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

  // Extract complex expressions for dependency array
  const lastMessage = useMemo(() => messages[messages.length - 1], [messages]);
  const lastMessageContent = lastMessage?.content;
  const lastMessageId = lastMessage?.id;

  useEffect(() => {
    if (messages.length > 0) {
      const scrollToBottom = () => {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        });
      };

      const timeoutId = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, lastMessageContent, lastMessageId]);

  const isLegacyChat = useMemo(
    () => (chat?.created_at ? VersionConfig.isLegacyChat(chat.created_at) : false),
    [chat?.created_at],
  );

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
    isLegacyChat,
    legacyMessage: VersionConfig.LEGACY_CHAT_MESSAGE,
  };
};
