import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypeChatInputProps } from "@/types/TypeChat";
import { useRef, useCallback, useState, useEffect, memo } from "react";

const ChatInterfaceInputComponent: React.FC<TypeChatInputProps> = ({
  inputValue,
  setInputValue,
  onSendMessage,
  isSending,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState("");

  useEffect(() => {
    if (inputValue === "") {
      setLocalValue("");
    }
  }, [inputValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalValue(e.target.value);
    },
    [],
  );

  const sendMessage = useCallback(() => {
    if (!localValue.trim() || isSending) return;

    onSendMessage(localValue);
    setLocalValue("");

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [onSendMessage, localValue, isSending]);

  const handleSendClick = useCallback(() => {
    sendMessage();
  }, [sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

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

export const ChatInterfaceInput = memo(
  ChatInterfaceInputComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.inputValue === nextProps.inputValue &&
      prevProps.isSending === nextProps.isSending &&
      prevProps.onSendMessage === nextProps.onSendMessage &&
      prevProps.setInputValue === nextProps.setInputValue
    );
  },
);

ChatInterfaceInput.displayName = "ChatInterfaceInput";
