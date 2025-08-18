import { MessageConstants } from "@/constants/MessageConstants";
import { TypeFile, TypeMessage } from "@/types/TypeSupabase";

/**
 * Compares two messages to determine if they are duplicates.
 * - For 'user' roles, it checks for identical content.
 * - For 'assistant' roles, it checks for identical content or thinking state replacement.
 *
 * @param msg1 The first message to compare.
 * @param msg2 The second message to compare.
 * @returns `true` if the messages are considered duplicates, `false` otherwise.
 */
export const areMessagesDuplicate = (
  msg1: TypeMessage,
  msg2: TypeMessage
): boolean => {
  if (msg1.role !== msg2.role) {
    return false;
  }

  // User messages are duplicates if content matches exactly
  if (msg1.role === "user") {
    return msg1.content === msg2.content;
  }

  // Assistant messages are duplicates if content matches exactly
  if (msg1.role === "assistant") {
    return msg1.content === msg2.content;
  }

  return false;
};

/**
 * Checks if a file object indicates a YouTube processing failure.
 *
 * @param file The file object to inspect.
 * @returns `true` if the file is a YouTube type with a 'failed' status and an error message.
 */
export const checkYouTubeProcessingError = (file: TypeFile): boolean => {
  return (
    file?.type === "youtube" &&
    file?.processing_status === "failed" &&
    !!file.processing_error
  );
};

/**
 * Synchronizes server-fetched messages with a local list, preserving pending optimistic updates.
 * Properly handles replacement of "thinking" messages with real assistant responses.
 *
 * @param serverMessages The authoritative list of messages from the server.
 * @param localMessages The current local state, which may include optimistic UI messages.
 * @returns A new, synchronized, and deduplicated array of messages.
 */
export const syncMessagesWithOptimisticUpdates = (
  serverMessages: TypeMessage[],
  localMessages: TypeMessage[]
): TypeMessage[] => {
  // Step 1: Filter out optimistic messages that have been confirmed by the server
  const pendingOptimisticMessages = localMessages.filter((localMsg) => {
    if (!localMsg.id.startsWith(MessageConstants.OptimisticIdPrefix)) {
      return false; // Not an optimistic message.
    }
    
    // Check if this optimistic message has been confirmed by the server
    const hasServerDuplicate = serverMessages.some((serverMsg) =>
      areMessagesDuplicate(localMsg, serverMsg)
    );
    
    return !hasServerDuplicate;
  });

  // Step 2: Remove "thinking" messages if there are real assistant responses
  const finalOptimisticMessages = pendingOptimisticMessages.filter((localMsg) => {
    // If this is a thinking message, check if there's a real assistant response
    if (localMsg.role === "assistant" && localMsg.content === MessageConstants.AssistantThinkingContent) {
      // Check if any server message is a real assistant response that should replace this thinking state
      const hasRealAssistantResponse = serverMessages.some((serverMsg) => 
        serverMsg.role === "assistant" && 
        serverMsg.content !== MessageConstants.AssistantThinkingContent
      );
      
      // If there's a real assistant response, remove the thinking message
      return !hasRealAssistantResponse;
    }
    
    return true;
  });

  // Step 3: Combine server messages with remaining optimistic messages and sort
  const combinedMessages = [...serverMessages, ...finalOptimisticMessages];
  
  // Sort by created_at to maintain chronological order
  return combinedMessages.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

/**
 * Creates a pair of optimistic messages (user and assistant) for immediate UI feedback.
 *
 * @param chatId The ID of the current chat.
 * @param content The text content of the user's message.
 * @returns An object containing `tempUserMessage` and `tempAiMessage`.
 */
export const createOptimisticMessages = (chatId: string, content: string) => {
  const timestamp = Date.now();
  const createdAt = new Date().toISOString();
  const tempId = `${MessageConstants.OptimisticIdPrefix}${timestamp}`;

  const tempUserMessage: TypeMessage = {
    id: tempId,
    chat_id: chatId,
    role: "user",
    content,
    created_at: createdAt,
  };

  const tempAiMessage: TypeMessage = {
    id: `${tempId}-ai`,
    chat_id: chatId,
    role: "assistant",
    content: MessageConstants.AssistantThinkingContent,
    created_at: createdAt,
  };

  return { tempUserMessage, tempAiMessage };
};

/**
 * Internal helper to create a message object from the assistant.
 * @private
 */
const _createAssistantMessage = (
  chatId: string,
  content: string
): TypeMessage => {
  return {
    id: `error-${Date.now()}`,
    chat_id: chatId,
    role: "assistant" as const,
    content,
    created_at: new Date().toISOString(),
  };
};

/**
 * Creates a formatted error message for a failed YouTube video processing job.
 *
 * @param chatId The ID of the current chat.
 * @param file The file object that failed to process.
 * @returns A message object formatted as an error from the assistant.
 */
export const createYouTubeErrorMessage = (
  chatId: string,
  file: TypeFile
): TypeMessage => {
  const errorMessage = `I couldn't process this YouTube video: ${
    file?.processing_error || MessageConstants.YouTubeDefaultError
  }`;
  return _createAssistantMessage(chatId, errorMessage);
};

/**
 * Creates a generic error message for a failed message send request.
 *
 * @param chatId The ID of the current chat.
 * @returns A generic error message object from the assistant.
 */
export const createErrorMessage = (chatId: string): TypeMessage => {
  return _createAssistantMessage(chatId, MessageConstants.GenericRequestError);
};