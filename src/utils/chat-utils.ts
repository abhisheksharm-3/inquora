import { TypeChatError } from "@/types/chat";
import { TypeChat, TypeFile } from "@/types/database";
import { Metadata } from "next";
import { supabaseBrowserClient } from "@/data/supabase/client";

// --- Constants for Error Handling and Retry Logic ---

const NonRetryableStatusCodes = new Set([400, 401, 403, 404]);
const MaxRetryAttempts = 3;
const RetryDelayBaseMs = 1000;
const MaxRetryDelayMs = 30000;

// --- Custom Error Utilities ---

/**
 * Creates a custom error object for chat-related operations.
 *
 * @param message The primary error message.
 * @param code An optional machine-readable error code (e.g., 'SUPABASE_ERROR').
 * @param statusCode An optional HTTP status code.
 * @returns A custom ChatError object.
 */
export const createChatError = (
  message: string,
  code?: string,
  statusCode?: number,
): TypeChatError => {
  const error = new Error(message) as TypeChatError;
  error.name = "ChatError";
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

/**
 * A type guard to check if an unknown value is a TypeChatError.
 *
 * @param error The value to check.
 * @returns `true` if the value is a valid TypeChatError, otherwise `false`.
 */
export const isChatError = (error: unknown): error is TypeChatError => {
  return error instanceof Error && error.name === "ChatError";
};

/**
 * Maps a Supabase error to a standardized TypeChatError.
 *
 * @param error The error object from a Supabase client response.
 * @param operation A description of the attempted operation (e.g., 'fetch chat').
 * @returns A standardized TypeChatError.
 */
export const getErrorFromSupabaseError = (
  error: { code?: string; message: string },
  operation: string,
): TypeChatError => {
  const errorMap = new Map<string, { message: string; statusCode: number }>([
    ["PGRST116", { message: "Resource not found", statusCode: 404 }],
    ["PGRST301", { message: "Authentication required", statusCode: 401 }],
  ]);

  const mappedError = error.code ? errorMap.get(error.code) : undefined;

  if (mappedError) {
    return createChatError(mappedError.message, error.code, mappedError.statusCode);
  }

  // Default fallback for unmapped Supabase errors
  return createChatError(
    `Failed to ${operation}: ${error.message}`,
    error.code || "SUPABASE_ERROR",
    500,
  );
};

// --- Validation Utilities ---

/**
 * A type guard to validate if a given value is a non-empty string.
 *
 * @param chatId The value to validate.
 * @returns `true` if the value is a valid string, otherwise `false`.
 */
export const validateChatId = (chatId: unknown): chatId is string => {
  return typeof chatId === "string" && chatId.trim() !== "";
};

// --- SWR/Query Retry Configuration ---

/**
 * Creates a configuration object for retry logic in data-fetching hooks (like SWR or React Query).
 * It prevents retries on client-side or auth errors and implements exponential backoff.
 *
 * @returns A configuration object with `retry` and `retryDelay` functions.
 */
export const createRetryConfig = () => ({
  retry: (failureCount: number, error: unknown) => {
    if (isChatError(error) && NonRetryableStatusCodes.has(error.statusCode || 0)) {
      return false; // Do not retry for 4xx errors.
    }
    return failureCount < MaxRetryAttempts;
  },
  retryDelay: (attemptIndex: number) =>
    Math.min(RetryDelayBaseMs * 2 ** attemptIndex, MaxRetryDelayMs),
});

// --- Metadata Generation ---

/**
 * Generates page metadata for a specific chat, fetching chat and associated file data.
 *
 * @param chatId The unique identifier for the chat.
 * @returns A promise that resolves to a Next.js Metadata object.
 */
export const generateChatMetadata = async (chatId: string): Promise<Metadata> => {
  if (!validateChatId(chatId)) {
    return generateFallbackMetadata({ isInvalid: true });
  }

  try {
    const supabase = supabaseBrowserClient();
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, title, file_id, created_at")
      .eq("id", chatId)
      .single<TypeChat>();

    if (chatError || !chat) {
      console.error("Error fetching chat data:", chatError?.message);
      return generateFallbackMetadata({ isNotFound: true });
    }

    let file: TypeFile | null = null;
    if (chat.file_id) {
      const { data: fileData } = await supabase
        .from("files")
        .select("name, type")
        .eq("id", chat.file_id)
        .single<TypeFile>();
      file = fileData; // Will be null if not found, which is handled below.
    }

    return buildMetadata(chat, file, chatId);
  } catch (error) {
    console.error(`Error generating metadata for chat ${chatId}:`, error);
    return generateFallbackMetadata({});
  }
};

/**
 * Creates a descriptive string for a file.
 * @private
 */
const createFileDescription = (fileName: string, fileType: string): string => {
  const descriptions: Record<string, string> = {
    pdf: `Chat about PDF: ${fileName}`,
    youtube: `Chat about YouTube video: ${fileName}`,
    text: `Chat about text document: ${fileName}`,
    github: `Chat about GitHub repo: ${fileName}`,
  };
  return descriptions[fileType] || `Chat about the file: ${fileName}`;
};

/**
 * Generates fallback metadata for loading, error, or not-found states.
 * @private
 */
const generateFallbackMetadata = ({
  isNotFound = false,
  isInvalid = false,
}: {
  isNotFound?: boolean;
  isInvalid?: boolean;
}): Metadata => {
  const title = isNotFound ? "Chat Not Found" : isInvalid ? "Invalid Chat ID" : "Chat";
  const description = isNotFound ? "The requested chat could not be found." : "A conversation.";

  return {
    title,
    description,
    robots: {
      index: false, // Do not index error/fallback pages.
      follow: false,
    },
  };
};

/**
 * Builds the final Metadata object from chat and file data.
 * @private
 */
const buildMetadata = (chat: TypeChat, file: TypeFile | null, chatId: string): Metadata => {
  const chatTitle = chat.title || "Untitled Chat";
  const pageTitle = `${chatTitle} - Conversation`;
  const description = file
    ? createFileDescription(file.name, file.type || "unknown")
    : "A conversation.";

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: `/chat/${chatId}`,
    },
    openGraph: {
      title: pageTitle,
      description,
      type: "website",
      locale: "en_US",
      url: `/chat/${chatId}`,
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description,
    },
  };
};
