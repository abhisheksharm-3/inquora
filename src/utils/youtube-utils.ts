/**
 * YouTube utilities module.
 *
 * This module contains client-side utility functions for working with YouTube videos.
 * These functions are not marked with "use server" and can be used on the client.
 */

/**
 * Extracts a YouTube video ID from various URL formats.
 * @param {string} url - The YouTube URL.
 * @returns {string | null} The 11-character video ID or null if not found.
 */
export const extractYoutubeVideoId = (url: string): string | null => {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

/**
 * Performs a preliminary, client-side check to validate a YouTube URL and extract its video ID.
 *
 * Note: This function assumes a transcript is available if the URL is valid.
 * The actual check for transcript existence is handled server-side.
 *
 * @param {string} url - The YouTube URL to check.
 * @returns {Promise<{ available: boolean; error?: string }>} An object indicating
 * preliminary availability and an error message if validation fails.
 */
export const checkYoutubeTranscriptAvailability = async (
  url: string,
): Promise<{ available: boolean; error?: string }> => {
  try {
    // Extract video ID from URL. This also validates the URL's structure.
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
      return {
        available: false,
        error: "Invalid YouTube URL. Could not extract video ID.",
      };
    }

    // Assume the video is valid and let server-side logic handle the actual transcript check.
    return { available: true };
  } catch (error) {
    console.error("Error checking YouTube transcript availability:", error);
    return {
      available: false,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while checking the URL.",
    };
  }
};

/**
 * Creates a system prompt for an AI assistant that answers questions about a
 * YouTube video using its transcript.
 * @param {string} transcriptContent - The transcript of the YouTube video.
 * @param {Object} context - Additional context information.
 * @param {string} context.currentDateTime - Current date and time.
 * @param {string} context.userName - User's name.
 * @param {string} context.userEmail - User's email.
 * @returns {string} A formatted system prompt string.
 */
export const createYoutubeSystemPrompt = (
  transcriptContent: string,
  context?: { currentDateTime?: string; userName?: string; userEmail?: string }
): string => {
  const contextInfo = context ? `

**Current Context:**
- Date/Time: ${context.currentDateTime || 'Not available'}
- User: ${context.userName || 'Anonymous'} (${context.userEmail || 'No email provided'})` : '';

  return `You are a helpful assistant that answers questions about a YouTube video based on its transcript.${contextInfo}

Here is the relevant transcript content to use when answering questions:

${transcriptContent}

When answering:
1. Only use information from the provided transcript content.
2. If the transcript doesn't contain the information needed to answer, say "I don't have enough information to answer that question based on the video transcript."
3. Keep your answers concise and focused on the question.
4. Do not make up information that isn't in the transcript.
5. If asked about topics unrelated to the video, politely redirect the conversation back to the video content.
6. You may address the user by name when providing responses, but keep it natural and not forced.`;
};