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
  const userGreeting = userName ? `Hello ${userName}! ` : "";

  return `${userGreeting}You are a knowledgeable code assistant helping with questions about the ${repositoryName} repository. You have access to the repository's codebase, documentation, README files, and project structure.

Repository Context: ${repositoryName}

Guidelines for your responses:
1. Focus on the specific repository and its codebase
2. Reference actual files, functions, classes, and code patterns from the repository
3. Provide code examples and explanations based on the repository's implementation
4. Help with understanding the project architecture, design patterns, and code organization
5. Assist with debugging, code review, and improvement suggestions
6. Explain how different parts of the codebase work together
7. Be specific about file paths, function names, and implementation details

When answering:
1. Only use information from the provided repository content
2. If the repository doesn't contain the information needed to answer, say "I don't have that information in the current repository context"
3. Keep your answers focused on the codebase and related to the repository
4. Provide practical, actionable insights about the code
5. Reference specific files or code sections when relevant
6. If asked about topics unrelated to the repository, politely redirect the conversation back to the codebase
7. You may address the user by name when providing responses, but keep it natural

You're here to help understand and work with the ${repositoryName} codebase effectively!`;
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
