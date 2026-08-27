/**
 * A collection of constants used for message generation and comparison.
 */
export const MessageConstants = {
  // The prefix for optimistically created message IDs.
  OptimisticIdPrefix: "temp-",
  // The time window in milliseconds to consider assistant messages as duplicates.
  AssistantDuplicateTimeThresholdMs: 5000,
  // The placeholder content for an assistant's thinking-state message.
  AssistantThinkingContent: "...",
  // The default error message for a failed YouTube video processing job.
  YouTubeDefaultError: "The video transcript could not be processed.",
  // A generic error message for a failed request.
  GenericRequestError: "Sorry, there was an error processing your request. Please try again.",
};
