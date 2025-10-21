/**
 * Processors index file
 *
 * This file exports all processors and utilities for easier imports
 */

// Export document processor
export * from "./document-processor";

// Export YouTube processor and utilities
export * from "./youtube-processor";

// Export query processor and utilities
export * from "./query-processor";

// Export GitHub processor orchestrator with fallback strategy (RECOMMENDED)
// This automatically tries: Clone → ZIP → API
export {
  processGitHubRepository,
  getGitHubRepositoryInfo,
  isValidGitHubUrl,
  extractGitHubRepoId,
  cleanupOrphanedTempDirectories,
} from "./github-processor-orchestrator";

// Export individual GitHub processors for advanced use cases
export { processGitHubRepository as processGitHubRepositoryWithAPI } from "./github-processor";
export { processGitHubRepositoryWithClone } from "./github-processor-clone";

// Export web scraping processor and utilities
export { processWebPage, getWebPageInfo } from "./web-scraper-server";
export { validateWebUrl, isValidWebUrl } from "../web-scraper-utils";
