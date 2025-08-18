// src/components/chat/ChatInterfaceInput.tsx

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypeChatInputProps } from "@/types/TypeChat";
import { useRef, useCallback, useState, useEffect } from "react";

/**
 * A themed "glass" input area for the chat interface. Uses a Textarea for better UX.
 * Fixed focus handling and cursor position issues by using independent local state.
 */
export const ChatInterfaceInput: React.FC<TypeChatInputProps> = ({
  inputValue, setInputValue, onSendMessage, isSending,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState("");
  const previousInputValueRef = useRef(inputValue);

  // Only sync when inputValue is cleared (after message sent) or initially set
  useEffect(() => {
    // If inputValue was cleared from outside (message sent), clear local value too
    if (inputValue === "" && previousInputValueRef.current !== "") {
      setLocalValue("");
    }
    // If inputValue is set from outside and local is empty, sync it
    else if (inputValue !== "" && localValue === "") {
      setLocalValue(inputValue);
    }
    previousInputValueRef.current = inputValue;
  }, [inputValue, localValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // Don't call setInputValue on every change to prevent re-renders
  }, []);

  const handleSendClick = useCallback(() => {
    if (!localValue.trim() || isSending) return;
    
    // Update global state with the current local value before sending
    setInputValue(localValue);
    onSendMessage();
    
    // Keep focus after sending
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 10);
  }, [onSendMessage, localValue, isSending, setInputValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (localValue.trim() && !isSending) {
        // Update global state with the current local value before sending
        setInputValue(localValue);
        onSendMessage();
        
        // Keep focus after sending
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 10);
      }
    }
  }, [onSendMessage, localValue, isSending, setInputValue]);

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