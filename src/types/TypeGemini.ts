
import { TypeSessionMetadata } from "@/types/TypeRag";
import { SupabaseClient } from "@supabase/supabase-js";

export interface GeminiUserContext {
    currentDateTime?: string;
    userName?: string;
    userEmail?: string;
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
    supabase?: SupabaseClient;
}

export interface GeminiMessage {
    role: "user" | "model";
    content: string;
}
