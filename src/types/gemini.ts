import { TypeSessionMetadata } from "@/types/rag";
import { TypeGeminiImageData } from "./content";

export interface GeminiUserContext {
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

export interface GeminiMessage {
    role: "user" | "model";
    content: string;
}

/**
 * Result type for prepareContextForGemini function.
 */
export interface PrepareContextResultType {
    fileContent?: string;
    imageData?: TypeGeminiImageData;
    error?: string;
    isAdvancedRAG?: boolean;
}
