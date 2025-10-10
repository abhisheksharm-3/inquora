import { Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypeChatInputProps } from "@/types/TypeChat";
import { useRef, useCallback, useState, useEffect, memo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ChatInterfaceInputComponent: React.FC<TypeChatInputProps> = ({
  inputValue,
  setInputValue,
  onSendMessage,
  isSending,
  isLegacyChat = false,
  legacyMessage,
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
        {isLegacyChat && legacyMessage && (
          <div className="mb-3 mx-2">
            <Alert className="border-blue-500/30 bg-blue-500/5 backdrop-blur-sm">
              <Lock className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-sm text-blue-200/90 leading-relaxed">
                {legacyMessage}
              </AlertDescription>
            </Alert>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isLegacyChat
              ? "This chat is view-only..."
              : "Ask a question about the document..."
          }
          rows={1}
          className="w-full resize-none rounded-lg border border-border bg-card p-3 pr-12 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={isSending || isLegacyChat}
          autoFocus={!isLegacyChat}
        />
        <Button
          onClick={handleSendClick}
          disabled={!localValue.trim() || isSending || isLegacyChat}
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-105 disabled:opacity-40"
        >
          {isLegacyChat ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
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
      prevProps.setInputValue === nextProps.setInputValue &&
      prevProps.isLegacyChat === nextProps.isLegacyChat &&
      prevProps.legacyMessage === nextProps.legacyMessage
    );
  },
);

ChatInterfaceInput.displayName = "ChatInterfaceInput";
