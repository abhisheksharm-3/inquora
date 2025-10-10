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
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
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
  context?: { currentDateTime?: string; userName?: string; userEmail?: string },
): string => {
  const contextInfo = context
    ? `

**Current Context:**
- Date/Time: ${context.currentDateTime || "Not available"}
- User: ${context.userName || "Anonymous"} (${context.userEmail || "No email provided"})`
    : "";

  return `# VIDEO TRANSCRIPT ANALYSIS${contextInfo}

**SOURCE:**
---
${transcriptContent}
---

**INSTRUCTIONS:**

Answer based ONLY on transcript above.

**FORMAT REQUIREMENTS:**
- Start responses with direct information
- No introductory phrases ("Here's a summary...", "The video discusses...", "Let me explain...")
- Use structure: headings, bullets, numbered lists
- State facts directly

**MISSING INFORMATION:**
- If info not in transcript: State "Transcript does not contain [specific information]"
- Don't elaborate, apologize, or suggest alternatives

**FORBIDDEN:**
❌ "Here's what the video covers..."
❌ "The presenter explains..."
❌ "Let me summarize..."
❌ "Based on the transcript..."
❌ "This video is about..."
❌ Any conversational AI voice

**REQUIRED:**
✅ Direct factual statements
✅ Structured information
✅ Clear, concise language
✅ Information-first approach

Examples:

BAD: "Based on the video transcript, here's a summary of the content. The video discusses Ray Dalio's analysis of..."

GOOD:
"**Ray Dalio's Analysis of Economic Cycles**

**Core Argument:**
- Empires follow predictable rise-and-fall patterns
- Current events mirror historical cycles (Dutch, British, US empires)

**Key Indicators:**
- Market strength
- Economic output
- Military capability..."

Start responses immediately with content. No preamble.`;
};
