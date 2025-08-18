// src/components/chat/ChatInterfaceInput.tsx

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypeChatInputProps } from "@/types/TypeChat";
import { useRef, useCallback, useState, useEffect } from "react";

/**
 * A themed "glass" input area for the chat interface. Uses a Textarea for better UX.
 * Uses local state to prevent cursor position issues.
 */
export const ChatInterfaceInput: React.FC<TypeChatInputProps> = ({
  inputValue, setInputValue, onSendMessage, isSending,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState("");

  // Only sync when the global input is cleared (after sending)
  useEffect(() => {
    if (inputValue === "") {
      setLocalValue("");
    }
  }, [inputValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // Don't update global state on every keystroke to prevent cursor issues
  }, []);

  const sendMessage = useCallback(() => {
    if (!localValue.trim() || isSending) return;
    
    // Update global state with current local value before sending
    setInputValue(localValue);
    onSendMessage();
    
    // Maintain focus after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [onSendMessage, localValue, isSending, setInputValue]);

  const handleSendClick = useCallback(() => {
    sendMessage();
  }, [sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="border-t border-white/10 p-1">
      <div className="relative mx-auto max-w-4xl">
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about the document..."
          rows={1}
          className="w-full resize-none rounded-lg border border-border bg-card p-3 pr-12 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200"
          disabled={isSending}
          autoFocus
        />
        <Button
          onClick={handleSendClick}
          disabled={!localValue.trim() || isSending}
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-105"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};