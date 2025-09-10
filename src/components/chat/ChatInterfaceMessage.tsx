// src/components/chat/ChatInterfaceMessages.tsx

import { Loader2 } from "lucide-react";
import { memo } from "react";
import Image from "next/image";
import { useUser } from "@/hooks/useUser";
import { TypeChatInterfaceMessagesProps } from "@/types/TypeChat";
import { getUserInitials } from "@/utils/dashboard-utils";
import { MessageConstants } from "@/constants/MessageConstants";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";

/**
 * Renders the message list with redesigned, themed chat bubbles.
 */
const ChatInterfaceMessagesComponent: React.FC<TypeChatInterfaceMessagesProps> = ({
  messages, messagesLoading, messagesEndRef, isSending,
}) => {
  const { user } = useUser();

  if (messagesLoading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading Messages...</span>
      </div>
    );
  }

  if (messages.length === 0 && !isSending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Image src="/logo.png" alt="Logo" width={48} height={48} className="mx-auto" />
          <p className="mt-4 font-medium text-foreground">Chat with your document</p>
          <p className="text-sm text-muted-foreground">Ask a question to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {/* Assistant Avatar */}
          {message.role === "assistant" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card p-1.5">
              <Image src="/logo.png" alt="AI" width={24} height={24} />
            </div>
          )}

          {/* Message Bubble */}
          <div
            className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground"
            }`}
          >
            {message.content === MessageConstants.AssistantThinkingContent ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span>Thinking...</span>
              </div>
            ) : message.role === "assistant" ? (
              <MarkdownRenderer 
                content={message.content} 
                className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              />
            ) : (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            )}
          </div>

          {/* User Avatar */}
          {message.role === "user" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card font-semibold text-primary">
              {getUserInitials(user)}
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};

// Memoize the messages component to prevent unnecessary re-renders
export const ChatInterfaceMessages = memo(ChatInterfaceMessagesComponent, (prevProps, nextProps) => {
  // Only re-render if messages content actually changed, not just array reference
  return (
    prevProps.messagesLoading === nextProps.messagesLoading &&
    prevProps.isSending === nextProps.isSending &&
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.messages.every((msg, index) => 
      msg.id === nextProps.messages[index]?.id && 
      msg.content === nextProps.messages[index]?.content
    )
  );
});