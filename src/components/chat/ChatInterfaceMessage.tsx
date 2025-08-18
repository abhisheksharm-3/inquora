// src/components/chat/ChatInterfaceMessages.tsx

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useUser } from "@/hooks/useUser";
import { TypeChatInterfaceMessagesProps } from "@/types/TypeChat";
import { getUserInitials } from "@/utils/dashboard-utils";

/**
 * Renders the message list with redesigned, themed chat bubbles.
 */
export const ChatInterfaceMessages: React.FC<TypeChatInterfaceMessagesProps> = ({
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
    <div className="h-full overflow-y-auto p-4 space-y-6 flex flex-col">
      <div className="flex-1 space-y-6">
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
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>

            {/* User Avatar */}
            {message.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card font-semibold text-primary">
                {getUserInitials(user)}
              </div>
            )}
          </div>
        ))}

         {/* AI "Thinking..." Indicator */}
        {isSending && (
          <div className="flex items-start gap-3 justify-start">
               <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card p-1.5">
                <Image src="/logo.png" alt="AI" width={24} height={24} />
              </div>
               <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span>Thinking...</span>
               </div>
          </div>
        )}
      </div>

      <div ref={messagesEndRef} />
    </div>
  );
};