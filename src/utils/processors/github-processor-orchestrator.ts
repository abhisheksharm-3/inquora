"use server";

/**
 * GitHub Repository Processor Orchestrator
 * 
 * This orchestrator implements a robust fallback strategy for processing GitHub repositories:
 * 
 * 1. Git Clone (First attempt): Fast, reliable, doesn't use API quota
 *    - Most efficient method when git is available
 *    - No API rate limits
 *    - Full repository access
 * 
 * 2. ZIP Download (Second attempt): Reliable fallback when git is unavailable
 *    - Works in serverless environments
 *    - No API rate limits
 *    - Good for environments without git
 * 
 * 3. GitHub API (Last resort): Fallback when clone and ZIP fail
 *    - Subject to API rate limits
 *    - Slower due to rate limiting
 *    - May fail mid-way if rate limit is exceeded
 * 
 * This order ensures maximum reliability while avoiding API quota issues.
 */

import { processGitHubRepositoryWithClone } from "./github-processor-clone";
import { processGitHubRepository as processGitHubRepositoryWithAPI } from "./github-processor";
import type { TypeGitHubProcessResult } from "@/types/TypeGitHub";

/**
 * Determines if an error is recoverable and should trigger a fallback
 * @private
 */
const _isRecoverableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const errorMessage = error.message.toLowerCase();

  // Errors that should trigger fallback to next method
  const recoverablePatterns = [
    "clone_unavailable",
    "git is not available",
    "git: command not found",
    "failed to clone",
    "failed to download",
    "git not found",
    "no such file or directory",
    "command not found",
    "enoent",
  ];

  return recoverablePatterns.some((pattern) => errorMessage.includes(pattern));
};

/**
 * Processes a GitHub repository with automatic fallback strategy
 * 
 * Attempts processing in the following order:
 * 1. Git Clone (if git is available)
 * 2. ZIP Download (if clone fails or git is unavailable)
 * 3. GitHub API (if both clone and ZIP fail)
 * 
 * @param repositoryUrl The URL of the GitHub repository
 * @param namespace The unique ID (and Pinecone namespace) for the file
 * @returns A promise that resolves with the outcome of the processing
 */
export const processGitHubRepositoryWithFallback = async (
  repositoryUrl: string,
  namespace: string,
): Promise<TypeGitHubProcessResult> => {
  console.log(
    `🚀 Starting GitHub repository processing with fallback strategy for: ${repositoryUrl}`,
  );
  console.log(`📦 Namespace: ${namespace}`);
  console.log(`🔄 Strategy: Clone → ZIP → API`);

  const errors: Array<{ method: string; error: string }> = [];

  // Attempt 1: Try git clone / ZIP download method
  try {
    console.log("\n=== ATTEMPT 1: GIT CLONE / ZIP DOWNLOAD ===");
    console.log("✓ This method is preferred (no API rate limits)");
    
    const result = await processGitHubRepositoryWithClone(
      repositoryUrl,
      namespace,
    );

    if (result.success) {
      console.log(
        `✅ Successfully processed repository using git clone/ZIP download method`,
      );
      console.log(`📊 Documents created: ${result.numDocs}`);
      return result;
    }

    // If not successful but no error thrown, record and continue
    if (result.error) {
      errors.push({
        method: "Git Clone/ZIP",
        error: result.error,
      });
      console.warn(
        `⚠️ Git clone/ZIP method completed but reported failure: ${result.error}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push({
      method: "Git Clone/ZIP",
      error: errorMessage,
    });

    console.warn(`⚠️ Git clone/ZIP method failed: ${errorMessage}`);

    // Check if this is a recoverable error
    if (!_isRecoverableError(error)) {
      console.error(
        `❌ Git clone/ZIP method failed with non-recoverable error. Skipping API fallback.`,
      );
      throw error; // Non-recoverable error, don't try other methods
    }

    console.log(`🔄 Error is recoverable, attempting next method...`);
  }

  // Attempt 2: Fallback to GitHub API method
  try {
    console.log("\n=== ATTEMPT 2: GITHUB API (FALLBACK) ===");
    console.log("⚠️ Using API method as fallback (subject to rate limits)");
    console.log(
      "💡 This method is slower and may fail if API rate limit is exceeded",
    );

    const result = await processGitHubRepositoryWithAPI(
      repositoryUrl,
      namespace,
    );

    if (result.success) {
      console.log(
        `✅ Successfully processed repository using GitHub API method (fallback)`,
      );
      console.log(`📊 Documents created: ${result.numDocs}`);
      console.log(
        `ℹ️ Note: Previous methods failed but API method succeeded`,
      );
      return result;
    }

    // If not successful but no error thrown, record it
    if (result.error) {
      errors.push({
        method: "GitHub API",
        error: result.error,
      });
      console.error(
        `❌ GitHub API method completed but reported failure: ${result.error}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push({
      method: "GitHub API",
      error: errorMessage,
    });

    console.error(`❌ GitHub API method failed: ${errorMessage}`);
  }

  // All methods failed
  console.error(
    `\n❌ ALL PROCESSING METHODS FAILED FOR: ${repositoryUrl}`,
  );
  console.error(`📋 Summary of failures:`);
  errors.forEach(({ method, error }, index) => {
    console.error(`   ${index + 1}. ${method}: ${error}`);
  });

  // Create comprehensive error message
  const errorSummary = [
    `Failed to process GitHub repository using all available methods:`,
    ...errors.map(({ method, error }) => `- ${method}: ${error}`),
    ``,
    `Please check:`,
    `1. Repository exists and is accessible`,
    `2. Network connectivity`,
    `3. GitHub API rate limits (if applicable)`,
    `4. Repository size (very large repositories may timeout)`,
  ].join("\n");

  return {
    numDocs: 0,
    success: false,
    error: errorSummary,
  };
};

/**
 * Main export - use this function instead of individual processor functions
 * to get automatic fallback behavior
 */
export const processGitHubRepository = processGitHubRepositoryWithFallback;

/**
 * Re-export other utilities from the processors
 */
export {
  getGitHubRepositoryInfo,
  isValidGitHubUrl,
  extractGitHubRepoId,
} from "./github-processor";

export { cleanupOrphanedTempDirectories } from "./github-processor-clone";
