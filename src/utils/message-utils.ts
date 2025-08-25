import { MessageConstants } from "@/constants/MessageConstants";
import { TypeMessage } from "@/types/TypeSupabase";

const areMessagesDuplicate = (msg1: TypeMessage, msg2: TypeMessage): boolean => {
  if (msg1.role !== msg2.role) {
    return false;
  }

  if (msg1.role === "user") {
    return msg1.content === msg2.content;
  }

  if (msg1.role === "assistant") {
    return msg1.content === msg2.content;
  }

  return false;
};

export const syncMessagesWithOptimisticUpdates = (
  serverMessages: TypeMessage[],
  localMessages: TypeMessage[]
): TypeMessage[] => {
  const pendingOptimisticMessages = localMessages.filter((localMsg) => {
    if (!localMsg.id.startsWith(MessageConstants.OptimisticIdPrefix)) {
      return false;
    }
    
    const hasServerDuplicate = serverMessages.some((serverMsg) =>
      areMessagesDuplicate(localMsg, serverMsg)
    );
    
    return !hasServerDuplicate;
  });

  const finalOptimisticMessages = pendingOptimisticMessages.filter((localMsg) => {
    if (localMsg.role === "assistant" && localMsg.content === MessageConstants.AssistantThinkingContent) {
      const hasRealAssistantResponse = serverMessages.some((serverMsg) => 
        serverMsg.role === "assistant" && 
        serverMsg.content !== MessageConstants.AssistantThinkingContent
      );
      
      return !hasRealAssistantResponse;
    }
    
    return true;
  });

  const combinedMessages = [...serverMessages, ...finalOptimisticMessages];
  
  return combinedMessages.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};