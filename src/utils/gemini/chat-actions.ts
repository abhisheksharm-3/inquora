"use server";

import { revalidatePath } from "next/cache";
import { isGeminiConfigured } from "@/utils/gemini/client";
import { supabaseServerClient } from "@/data/supabase/server";
import { TypeChat } from "@/types/database";

const FILE_TYPE_MAP = new Map([
  ["youtube", "video"],
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

const mapFileTypeToChatType = (fileType: string | null): TypeChat["type"] => {
  if (!fileType) return null;

  if (FILE_TYPE_MAP.has(fileType)) {
    return FILE_TYPE_MAP.get(fileType)! as TypeChat["type"];
  }

  return VALID_CHAT_TYPES.has(fileType) ? (fileType as TypeChat["type"]) : null;
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
