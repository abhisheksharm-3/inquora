import { useChats } from "@/hooks/useChats";
import { TypeFile, TypeMessage } from "./TypeSupabase";
import { useFileById } from "@/hooks/useFiles";

export interface TypeChatInterfaceMessagesProps {
  messages: TypeMessage[];
  messagesLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isSending?: boolean;
}

export interface TypeChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSendMessage: (message?: string) => void;
  isSending?: boolean;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  className?: string;
}

export interface TypeChatInterfaceDocumentViewerProps {
  file: TypeFile;
  isLoading: boolean;
  isError: boolean;
  title: string;
}

export interface TypeChatInterfaceMobileTabsProps {
  showDocument: boolean;
  setShowDocument: (show: boolean) => void;
}

export interface TypeControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onDownload: () => void;
  onOpenInNewTab: () => void;
  showControls: boolean;
  file?: TypeFile;
}

export type TypeChatError = Error & {
  name: "ChatError";
  code?: string;
  statusCode?: number;
};

export interface TypeUseChatInterfaceProps {
  chatId: string;
}

export interface TypeUseChatInterfaceReturn {
  // State
  inputValue: string;
  setInputValue: (value: string) => void;
  showDocument: boolean;
  setShowDocument: (show: boolean) => void;
  localMessages: TypeMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  
  // Derived state
  chat: ReturnType<ReturnType<typeof useChats>['getChatById']>;
  file: ReturnType<typeof useFileById>['data'];
  isChatLoading: boolean;
  isChatError: boolean;
  messagesLoading: boolean;
  isFileLoading: boolean;
  isFileError: boolean;
  isSending: boolean;
  
  // Handlers
  handleSendMessage: () => Promise<void>;
  handleKeyPress: (e: React.KeyboardEvent) => void;
}

export interface TypeChatInterfaceState {
  inputValue: string;
  showDocument: boolean;
  localMessages: TypeMessage[];
}