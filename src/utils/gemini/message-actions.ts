"use server";

import { sendMessageToGemini, isGeminiConfigured } from "@/utils/gemini/client";
import { supabaseServerClient } from "@/data/supabase/server";
import { getFileContent, getImageData } from "../file-processing-utils";
import { queryDocuments } from "../processors";
import { SupabaseClient } from "@supabase/supabase-js";
import { TypeChat, TypeFile } from "@/types/database";
import { processRAGRequest } from "../rag/orchestrator";
import { TypeRAGRequest, TypeConversationTurn, TypeSessionMetadata } from "@/types/rag";
import { VersionConfig } from "@/constants/version-config";
import { TypeGeminiMessage, TypeGeminiUserContext, TypeGeminiContextResult } from "@/types/gemini";

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
  chat: TypeChat & { files: TypeFile | null },
  userQuery: string,
  supabase: SupabaseClient,
  conversationHistory?: Array<{ role: string, content: string }>,
  userContext?: TypeGeminiUserContext
): Promise<TypeGeminiContextResult> => {
  if (!chat.file_id) return {};

  const fileContent = await getFileContent(chat.file_id);
  if (!fileContent) return {};

  if (fileContent.startsWith("ERROR:")) {
    const errorMessage = fileContent.substring(6).trim();

    if (errorMessage.includes("not been processed yet")) {
      return {
        error: `I need a moment to analyze this document before we can chat about it. The document processing wasn't completed during upload. Please try uploading the document again, and I'll process it fully before creating the chat.`,
      };
    } else if (errorMessage.includes("Failed to process")) {
      return {
        error: "I had trouble processing this document. This might be due to the document format, content access restrictions, or temporary processing issues. Please try uploading the document again.",
      };
    } else {
      return {
        error: "I encountered an issue with this document. Please try uploading it again or contact support if the problem persists.",
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
              expertise_level: userContext?.sessionMetadata?.expertise_level || 'intermediate',
              preferences: {
                response_style: userContext?.sessionMetadata?.preferences?.response_style || 'detailed',
                include_sources: userContext?.sessionMetadata?.preferences?.include_sources ?? true,
                include_reasoning: userContext?.sessionMetadata?.preferences?.include_reasoning ?? true
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
            return {
              fileContent: ragResponse.systemPrompt,
              isAdvancedRAG: true
            };
          }
        } catch (advancedRAGError) {
          console.warn("Advanced RAG failed, falling back to basic retrieval:", advancedRAGError);
        }
      }

      const relevantDocs = await queryDocuments(userQuery, chat.file_id, 5);

      if (!relevantDocs || relevantDocs.length === 0) {
        return {
          error:
            "I don't have enough information from this document to answer your question. This might mean the document wasn't fully processed or doesn't contain relevant content for your query. Please try rephrasing your question or ensure the document was uploaded correctly.",
        };
      }

      const combinedContent = relevantDocs
        .map(([doc]) => doc.pageContent)
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
  messages?: TypeGeminiMessage[],
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

    if (VersionConfig.isLegacyChat(chat.created_at)) {
      return saveAssistantMessage(
        chatId,
        VersionConfig.LEGACY_CHAT_MESSAGE,
        supabase,
      );
    }

    const userContext: TypeGeminiUserContext = {
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
      }

      const { data: memories } = await supabase
        .from("user_memories")
        .select("content")
        .eq("user_id", chat.user_id);

      if (memories) {
        userContext.memories = memories.map(m => m.content);
      }

      const { data: recentChats } = await supabase
        .from("chats")
        .select("id, title, created_at")
        .eq("user_id", chat.user_id)
        .neq("id", chatId)
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

    const formattedMessages: TypeGeminiMessage[] = [
      ...(messages || []),
      { role: "user", content },
    ];

    const enhancedUserContext = {
      ...userContext,
      chatId,
      userQuery: content,
      conversationHistory,
      documentType: chat.type || undefined,
      namespace: chat.file_id || undefined,
      isAdvancedRAG: context.isAdvancedRAG,
      userId: chat.user_id,
    };

    const response = await sendMessageToGemini(
      formattedMessages,
      context.fileContent,
      context.imageData,
      enhancedUserContext,
      supabase,
    );

    return await saveAssistantMessage(chatId, response, supabase);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    const errorMessage =
      "I'm sorry, an unexpected error occurred. Please try again.";
    return await saveAssistantMessage(chatId, errorMessage, supabase);
  }
};
