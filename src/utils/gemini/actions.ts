"use server";

import { revalidatePath } from "next/cache";
import { sendMessageToGemini, isGeminiConfigured } from "@/utils/gemini/client";
import { supabaseServerClient } from "@/utils/supabase/server";
import { getFileContent, getImageData } from "../file-processing-utils";
import { queryDocuments } from "../processors";
import { SupabaseClient } from "@supabase/supabase-js";
import { TypeChat, TypeFile } from "@/types/TypeSupabase";
import { TypeGeminiImageData } from "@/types/TypeContent";
import { processRAGRequest } from "../rag/orchestrator";
import { TypeRAGRequest, TypeConversationTurn, TypeSessionMetadata } from "@/types/TypeRag";
import { VersionConfig } from "@/constants/VersionConfig";

const FILE_TYPE_MAP = new Map([
  ["youtube", "video"],
  ["web", "video"],
  ["url", "video"],
  ["doc", "doc"],
  ["docs", "doc"],
  ["docx", "doc"],
  ["sheet", "sheet"],
  ["sheets", "sheet"],
  ["xls", "sheet"],
  ["xlsx", "sheet"],
  ["slides", "slides"],
  ["ppt", "slides"],
  ["pptx", "slides"],
  ["github", "github"],
  ["web", "web"],
]);

const VALID_CHAT_TYPES = new Set([
  "pdf",
  "image",
  "doc",
  "video",
  "sheet",
  "slides",
  "github",
  "web",
]);

const mapFileTypeToChatType = (fileType: string | null): string | null => {
  if (!fileType) return null;

  if (FILE_TYPE_MAP.has(fileType)) {
    return FILE_TYPE_MAP.get(fileType)!;
  }

  return VALID_CHAT_TYPES.has(fileType) ? fileType : null;
};

export const createChat = async (fileId: string, userId?: string) => {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API is not configured.");
  }
  if (!userId) {
    throw new Error("Authentication required to create a chat.");
  }

  const supabase = await supabaseServerClient();

  try {
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, name, type")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      throw new Error(
        `File not found with ID: ${fileId}. ${fileError?.message || ""}`,
      );
    }

    const chatType = mapFileTypeToChatType(file.type);

    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        user_id: userId,
        file_id: fileId,
        title: `Chat about ${file.name || "file"}`,
        type: chatType,
      })
      .select()
      .single();

    if (chatError || !chat) {
      throw new Error(`Failed to create chat: ${chatError?.message}`);
    }

    revalidatePath("/chat");
    return chat;
  } catch (error) {
    console.error("Error in createChat:", error);
    throw error;
  }
};

const RAG_SUPPORTED_TYPES = new Set([
  "pdf",
  "doc",
  "sheet",
  "slides",
  "video",
  "github",
  "web",
]);

const prepareContextForGemini = async (
  chat: TypeChat & { files: TypeFile },
  userQuery: string,
  supabase: SupabaseClient,
  conversationHistory?: Array<{ role: string, content: string }>,
  userContext?: {
    currentDateTime?: string;
    userName?: string;
    userEmail?: string;
    memories?: string[];
    sessionMetadata?: TypeSessionMetadata;
    recentConversations?: { id: string, title: string, timestamp: string }[];
  }
): Promise<{
  fileContent?: string;
  imageData?: TypeGeminiImageData;
  error?: string;
  isAdvancedRAG?: boolean;
}> => {
  if (!chat.file_id) return {};

  const fileContent = await getFileContent(chat.file_id);
  if (!fileContent) return {};

  if (fileContent.startsWith("ERROR:")) {
    const errorMessage = fileContent.substring(6).trim();

    // Provide more helpful error messages based on the error type
    if (errorMessage.includes("not been processed yet")) {
      return {
        error: `I need a moment to analyze this document before we can chat about it. The document processing wasn't completed during upload. Please try uploading the document again, and I'll process it fully before creating the chat.`,
      };
    } else if (errorMessage.includes("Failed to process")) {
      return {
        error: `I had trouble processing this document: ${errorMessage}. This might be due to the document format, content access restrictions, or temporary processing issues. Please try uploading the document again.`,
      };
    } else {
      return {
        error: `I encountered an issue with this document: ${errorMessage}. Please try uploading it again or contact support if the problem persists.`,
      };
    }
  }

  if (chat.files?.type === "image") {
    const imageData = await getImageData(supabase, chat.files);
    if (!imageData) {
      return {
        error:
          "I couldn't access the image file. Please try uploading it again.",
      };
    }
    return { imageData };
  }

  if (chat.type && RAG_SUPPORTED_TYPES.has(chat.type)) {
    try {
      // Try advanced RAG system first
      if (chat.file_id && conversationHistory) {
        try {
          const ragRequest: TypeRAGRequest = {
            query: userQuery,
            chatId: chat.id,
            namespace: chat.file_id,
            conversationHistory: conversationHistory.map((msg, index) => ({
              id: `turn-${index}`,
              timestamp: new Date().toISOString(),
              userQuery: msg.role === 'user' ? msg.content : '',
              aiResponse: msg.role === 'assistant' || msg.role === 'model' ? msg.content : '',
              confidence: 0.8
            } as TypeConversationTurn)).filter(turn => turn.userQuery || turn.aiResponse),
            userContext: {
              name: userContext?.userName,
              email: userContext?.userEmail,
              expertise_level: 'intermediate',
              preferences: {
                response_style: 'detailed',
                include_sources: true,
                include_reasoning: true
              },
              memories: userContext?.memories,
              sessionMetadata: userContext?.sessionMetadata,
              recentConversations: userContext?.recentConversations
            },
            documentContext: {
              type: chat.type || 'general',
              domain: 'general',
              contentSource: {
                type: (chat.type as 'pdf' | 'youtube' | 'website' | 'github' | 'doc' | 'sheet' | 'slides' | 'image') || 'document',
                format: 'extracted_text',
                extractionMethod: 'automatic_processing',
                confidence: 0.8,
                qualityMetrics: {
                  readability: 'standard',
                  completeness: 'complete',
                  accuracy: 0.85
                }
              },
              processingQuality: 'high',
              metadata: {
                contentLength: fileContent.length,
                timestamp: userContext?.currentDateTime
              }
            }
          };

          const ragResponse = await processRAGRequest(ragRequest);

          if (ragResponse.retrievedSources && ragResponse.retrievedSources.length > 0) {
            const combinedContent = ragResponse.retrievedSources
              .map((result: { document: { pageContent: string } }) => result.document.pageContent)
              .join("\n\n");
            return {
              fileContent: combinedContent,
              isAdvancedRAG: true
            };
          }
        } catch (advancedRAGError) {
          console.warn("Advanced RAG failed, falling back to basic retrieval:", advancedRAGError);
        }
      }

      // Fallback to basic RAG
      const relevantDocs = await queryDocuments(userQuery, chat.file_id, 5);

      if (!relevantDocs || relevantDocs.length === 0) {
        return {
          error:
            "I don't have enough information from this document to answer your question. This might mean the document wasn't fully processed or doesn't contain relevant content for your query. Please try rephrasing your question or ensure the document was uploaded correctly.",
        };
      }

      const combinedContent = relevantDocs
        .map((doc) => doc.pageContent)
        .join("\n\n");
      return { fileContent: combinedContent };
    } catch (queryError) {
      console.error(`Error querying ${chat.type} content:`, queryError);
      return {
        error:
          "I'm having trouble accessing the processed document content. Please try asking your question again, or re-upload the document if the issue persists.",
      };
    }
  }

  return { fileContent };
};

const saveAssistantMessage = async (
  chatId: string,
  content: string,
  supabase: SupabaseClient,
) => {
  const { data, error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, role: "assistant", content })
    .select()
    .single();

  if (error) {
    console.error("Error saving assistant message:", error);
  }
  return data;
};

export const sendMessage = async (
  chatId: string,
  content: string,
  messages?: { role: "user" | "model"; content: string }[],
  sessionMetadata?: TypeSessionMetadata,
) => {
  if (!isGeminiConfigured()) {
    return saveAssistantMessage(
      chatId,
      "Gemini API is not configured.",
      await supabaseServerClient(),
    );
  }

  const supabase = await supabaseServerClient();

  try {
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("*, files(*)")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) throw new Error("Chat not found.");

    // Check if this is a legacy chat (read-only)
    if (VersionConfig.isLegacyChat(chat.created_at)) {
      return saveAssistantMessage(
        chatId,
        VersionConfig.LEGACY_CHAT_MESSAGE,
        supabase,
      );
    }

    // Get user information for context
    const userContext: {
      currentDateTime?: string;
      userName?: string;
      userEmail?: string;
      memories?: string[];
      sessionMetadata?: TypeSessionMetadata;
      recentConversations?: { id: string, title: string, timestamp: string }[];
    } = {
      currentDateTime: new Date().toLocaleString("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    };

    if (chat.user_id) {
      const { data: user } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", chat.user_id)
        .single();

      if (user) {
        userContext.userName = user.name || "Anonymous";
        userContext.userEmail = user.email || "";
      }

      // Fetch User Memories
      const { data: memories } = await supabase
        .from("user_memories")
        .select("content")
        .eq("user_id", chat.user_id);

      if (memories) {
        userContext.memories = memories.map(m => m.content);
      }

      // Fetch Recent Conversations
      const { data: recentChats } = await supabase
        .from("chats")
        .select("id, title, created_at")
        .eq("user_id", chat.user_id)
        .neq("id", chatId) // Exclude current chat
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentChats) {
        userContext.recentConversations = recentChats.map(c => ({
          id: c.id,
          title: c.title || "Untitled Chat",
          timestamp: c.created_at
        }));
      }
    }

    if (sessionMetadata) {
      userContext.sessionMetadata = sessionMetadata;
    }

    await supabase
      .from("messages")
      .insert({ chat_id: chatId, role: "user", content });

    // Prepare conversation history for advanced RAG
    const conversationHistory = messages?.map(msg => ({
      role: msg.role === "model" ? "assistant" : msg.role,
      content: msg.content
    })) || [];

    const context = await prepareContextForGemini(
      chat,
      content,
      supabase,
      conversationHistory,
      userContext
    );

    if (context.error) {
      return await saveAssistantMessage(chatId, context.error, supabase);
    }

    const formattedMessages: { role: "user" | "model"; content: string }[] = [
      ...(messages || []),
      { role: "user", content },
    ];

    // Enhanced context information for Gemini
    const enhancedUserContext = {
      ...userContext,
      chatId,
      userQuery: content,
      conversationHistory,
      documentType: chat.type,
      namespace: chat.file_id,
      isAdvancedRAG: context.isAdvancedRAG,
      userId: chat.user_id,
      supabase: supabase
    };

    const response = await sendMessageToGemini(
      formattedMessages,
      context.fileContent,
      context.imageData,
      enhancedUserContext,
    );

    return await saveAssistantMessage(chatId, response, supabase);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    const errorMessage =
      "I'm sorry, an unexpected error occurred. Please try again.";
    return await saveAssistantMessage(chatId, errorMessage, supabase);
  }
};
