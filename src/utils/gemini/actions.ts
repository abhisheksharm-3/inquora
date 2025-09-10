"use server";

import { revalidatePath } from "next/cache";
import { sendMessageToGemini, isGeminiConfigured } from "@/utils/gemini/client";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import { getFileContent, getImageData } from "../file-processing-utils";
import { queryDocuments } from "../processors";
import { SupabaseClient } from "@supabase/supabase-js";
import { TypeChat, TypeFile } from "@/types/TypeSupabase";
import { TypeGeminiImageData } from "@/types/TypeContent";

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

  const supabase = supabaseBrowserClient();

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
): Promise<{
  fileContent?: string;
  imageData?: TypeGeminiImageData;
  error?: string;
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
) => {
  if (!isGeminiConfigured()) {
    return saveAssistantMessage(
      chatId,
      "Gemini API is not configured.",
      supabaseBrowserClient(),
    );
  }

  const supabase = supabaseBrowserClient();

  try {
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("*, files(*)")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) throw new Error("Chat not found.");

    // Get user information for context
    const userContext: {
      currentDateTime?: string;
      userName?: string;
      userEmail?: string;
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
    }

    await supabase
      .from("messages")
      .insert({ chat_id: chatId, role: "user", content });

    const context = await prepareContextForGemini(chat, content, supabase);
    if (context.error) {
      return await saveAssistantMessage(chatId, context.error, supabase);
    }

    const formattedMessages: { role: "user" | "model"; content: string }[] = [
      ...(messages || []),
      { role: "user", content },
    ];

    const response = await sendMessageToGemini(
      formattedMessages,
      context.fileContent,
      context.imageData,
      userContext,
    );

    return await saveAssistantMessage(chatId, response, supabase);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    const errorMessage =
      "I'm sorry, an unexpected error occurred. Please try again.";
    return await saveAssistantMessage(chatId, errorMessage, supabase);
  }
};
