/**
 * GitHub utilities module.
 *
 * This module contains client-side utility functions for working with GitHub repositories.
 * These functions are not marked with "use server" and can be used on the client.
 */

/**
 * Extracts owner and repository name from a GitHub URL.
 * @param {string} url - The GitHub URL.
 * @returns {{ owner: string; repo: string } | null} The owner and repository name or null if not found.
 */
export const extractGitHubRepoInfo = (
  url: string,
): { owner: string; repo: string } | null => {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?#]+)/i, // Standard GitHub URLs
    /^([^\/]+)\/([^\/\?#]+)$/i, // owner/repo format
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, ""); // Remove .git suffix if present
      return { owner, repo };
    }
  }

  return null;
};

/**
 * Validates if a string is a valid GitHub repository URL.
 * @param {string} url - The URL to validate.
 * @returns {boolean} Returns true if the URL is a valid GitHub repository URL.
 */
export const isValidGitHubUrl = (url: string): boolean => {
  if (!url.trim()) return false;
  return extractGitHubRepoInfo(url) !== null;
};

/**
 * Performs a preliminary, client-side check to validate a GitHub repository URL.
 *
 * Note: This function only validates the URL format. The actual check for repository
 * existence and accessibility is handled server-side or via the GitHub API.
 *
 * @param {string} url - The GitHub repository URL to check.
 * @returns {Promise<{ valid: boolean; error?: string }>} An object indicating
 * preliminary validity and an error message if validation fails.
 */
export const checkGitHubRepoUrlValidity = async (
  url: string,
): Promise<{ valid: boolean; error?: string }> => {
  try {
    if (!url.trim()) {
      return {
        valid: false,
        error: "Repository URL is required.",
      };
    }

    // Extract repo info from URL. This also validates the URL's structure.
    const repoInfo = extractGitHubRepoInfo(url);
    if (!repoInfo) {
      return {
        valid: false,
        error:
          "Invalid GitHub URL format. Expected format: https://github.com/owner/repo",
      };
    }

    // Basic validation of owner and repo names
    const { owner, repo } = repoInfo;

    if (owner.length === 0 || repo.length === 0) {
      return {
        valid: false,
        error: "Both owner and repository name are required.",
      };
    }

    // Check for invalid characters (basic check)
    const validNamePattern = /^[a-zA-Z0-9\-._]+$/;
    if (!validNamePattern.test(owner) || !validNamePattern.test(repo)) {
      return {
        valid: false,
        error: "Owner and repository names contain invalid characters.",
      };
    }

    // Assume the repository URL is valid and let server-side logic handle actual accessibility
    return { valid: true };
  } catch (error) {
    console.error("Error checking GitHub repository URL validity:", error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while validating the URL.",
    };
  }
};

/**
 * Generates a system prompt for chat interactions with GitHub repository content.
 * This provides context and guidelines for AI responses when discussing code.
 *
 * @param {string} repositoryName - The name of the repository (owner/repo format).
 * @param {string} [userName] - Optional username for personalization.
 * @returns {string} A comprehensive system prompt for GitHub repository chat.
 */
export const generateGitHubChatSystemPrompt = (
  repositoryName: string,
  userName?: string,
): string => {
  const userContext = userName ? `\n**User:** ${userName}` : "";

  return `# CODE REPOSITORY ANALYSIS: ${repositoryName}${userContext}

**SCOPE:** Codebase, documentation, README, project structure

**INSTRUCTIONS:**

Answer based ONLY on ${repositoryName} repository content.

**RESPONSE FORMAT:**
- Start with direct technical information
- No introductory phrases ("Let me analyze...", "Here's what I found...", "The repository...")
- Use code blocks for examples
- Reference specific files and line numbers
- Structure: headings, bullets, code samples

**MISSING INFO:**
State: "${repositoryName} repository does not contain [specific file/component]"

**FORBIDDEN:**
❌ "Let me explain the architecture..."
❌ "This repository uses..."
❌ "Based on my analysis..."
❌ "Here's how the code works..."
❌ Conversational explanations
❌ General programming advice not specific to this repo

**REQUIRED:**
✅ Direct technical statements
✅ Specific file references
✅ Code examples from repository
✅ Clear structure

Examples:

BAD: "Let me explain how this repository works. The codebase is structured with..."

GOOD:
"**Project Architecture**

\`\`\`
src/
  components/  - React UI components
  utils/       - Helper functions
  hooks/       - Custom React hooks
\`\`\`

**Key Files:**
- \`src/utils/auth.ts\` - Authentication logic (lines 45-120)
- \`src/components/Button.tsx\` - Reusable button component

**Dependencies:**
- React 18.2.0
- TypeScript 5.0..."

Deliver information directly. No preamble or meta-commentary.`;
};

/**
 * Formats a GitHub repository URL for display purposes.
 * @param {string} url - The GitHub repository URL.
 * @returns {string} A formatted, display-friendly version of the URL.
 */
export const formatGitHubRepoForDisplay = (url: string): string => {
  const repoInfo = extractGitHubRepoInfo(url);
  if (!repoInfo) return url;

  return `${repoInfo.owner}/${repoInfo.repo}`;
};

/**
 * Checks if a URL points to a GitHub repository (not just any GitHub URL).
 * @param {string} url - The URL to check.
 * @returns {boolean} Returns true if the URL is specifically a GitHub repository URL.
 */
export const isGitHubRepositoryUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);

    // Must be github.com
    if (
      urlObj.hostname !== "github.com" &&
      urlObj.hostname !== "www.github.com"
    ) {
      return false;
    }

    // Must have owner/repo pattern
    const pathParts = urlObj.pathname
      .split("/")
      .filter((part) => part.length > 0);
    return pathParts.length >= 2; // At least owner and repo
  } catch {
    return false;
  }
};

/**
 * Gets a user-friendly error message for common GitHub repository URL issues.
 * @param {string} url - The problematic URL.
 * @returns {string} A user-friendly error message.
 */
export const getGitHubUrlErrorMessage = (url: string): string => {
  if (!url.trim()) {
    return "Please enter a GitHub repository URL";
  }

  if (!url.includes("github.com")) {
    return "Please enter a valid GitHub repository URL (must include github.com)";
  }

  if (!isGitHubRepositoryUrl(url)) {
    return "Please enter a complete repository URL (e.g., https://github.com/owner/repository)";
  }

  return "Invalid repository URL format";
};
