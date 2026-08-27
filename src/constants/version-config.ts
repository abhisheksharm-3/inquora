/**
 * Version Configuration
 *
 * Controls compatibility and access to features across different versions.
 * Update these values when making breaking changes (like embedding model updates).
 */

export const VersionConfig = {
  /**
   * Chat Version Cutoff Date
   *
   * Chats created before this date are read-only due to embedding model incompatibility.
   * Format: ISO 8601 date string (YYYY-MM-DD)
   *
   * Current: January 14, 2026 - When embedding model changed to 1024d custom embeddings
   */
  CHAT_VERSION_CUTOFF_DATE: "2026-01-14T00:00:00.000Z",

  /**
   * User-friendly message shown when trying to send messages to legacy chats
   */
  LEGACY_CHAT_MESSAGE:
    "Chats created before January 14, 2026 are view-only. Please create a new chat with the same document to continue.",

  /**
   * Check if a chat is legacy (read-only)
   * @param chatCreatedAt - ISO timestamp of when the chat was created
   * @returns true if chat is legacy and should be read-only
   */
  isLegacyChat: (chatCreatedAt: string): boolean => {
    const cutoffDate = new Date(VersionConfig.CHAT_VERSION_CUTOFF_DATE);
    const chatDate = new Date(chatCreatedAt);
    return chatDate < cutoffDate;
  },
} as const;
