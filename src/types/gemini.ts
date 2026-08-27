import { TypeSessionMetadata } from "@/types/rag";
import { TypeGeminiImageData } from "./content";

export interface TypeGeminiUserContext {
  currentDateTime?: string;
  userName?: string;
  chatId?: string;
  userQuery?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  documentType?: string;
  namespace?: string;
  isAdvancedRAG?: boolean;
  memories?: string[];
  sessionMetadata?: TypeSessionMetadata;
  recentConversations?: { id: string; title: string; timestamp: string }[];
  userId?: string;
}

export interface TypeGeminiMessage {
  role: "user" | "model";
  content: string;
}

export interface TypeGeminiContextResult {
  fileContent?: string;
  imageData?: TypeGeminiImageData;
  error?: string;
  isAdvancedRAG?: boolean;
}
