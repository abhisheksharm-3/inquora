"use server";

/**
 * GitHub Repository Processor with Multiple Download Methods
 * 
 * This processor supports two methods for downloading GitHub repositories:
 * 1. Git Clone (preferred): Uses git clone command for full repository access
 * 2. ZIP Download (fallback): Downloads repository as ZIP archive via GitHub API
 * 
 * The ZIP download method is automatically used when:
 * - Running in Vercel, Netlify, or other serverless environments
 * - Git is not available on the system
 * - DISABLE_GIT environment variable is set
 * 
 * This ensures the processor works in both development and production environments
 * while avoiding GitHub API rate limits by preferring direct git access when possible.
 */

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";
import { supabaseBrowserClient } from "../supabase/client";
import { updateFileStatus } from "../file-processing-utils";
import type {
  TypeGitHubRepositoryInfo,
  TypeGitHubProcessResult,
  TypeGitHubParseResult,
} from "@/types/TypeGitHub";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import JSZip from "jszip";

const execAsync = promisify(exec);

// --- Constants ---
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit per file

// File extensions to include in processing
const PROCESSABLE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".cs",
  ".php",
  ".rb",
  ".go",
  ".rs",
  ".kt",
  ".swift",
  ".sql",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".sh",
  ".bat",
  ".ps1",
  ".r",
  ".m",
  ".scala",
  ".clj",
  ".hs",
  ".elm",
  ".dart",
  ".lua",
  ".pl",
  ".vim",
  ".config",
  ".env",
  ".gitignore",
  ".dockerfile",
  "dockerfile",
  "makefile",
  "readme",
]);

// Directories to skip
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".nyc_output",
  "vendor",
  "target",
  ".vscode",
  ".idea",
  "__pycache__",
  ".pytest_cache",
  ".cache",
  "tmp",
  "temp",
  ".DS_Store",
  "logs",
  "*.log",
  ".env.local",
  ".env.production",
]);

/**
 * Extracts owner and repository name from GitHub URL
 * @private
 */
const _parseGitHubUrl = (url: string): TypeGitHubParseResult | null => {
  console.log(`Parsing GitHub URL: ${url}`);

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
      console.log(`Extracted: owner=${owner}, repo=${repo}`);
      return { owner, repo };
    }
  }

  console.error(`Failed to parse GitHub URL: ${url}`);
  return null;
};

/**
 * Repository info interface for filesystem extraction
 */
interface RepositoryInfo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  size: number;
  updated_at: string;
  default_branch: string;
}

/**
 * Extracts repository information from cloned repository
 * @private
 */
const _extractRepositoryInfoFromFS = async (
  repoPath: string,
  owner: string,
  repo: string,
): Promise<RepositoryInfo> => {
  console.log(
    `Extracting repository info from filesystem for ${owner}/${repo}...`,
  );

  const repoInfo: RepositoryInfo = {
    name: repo,
    full_name: `${owner}/${repo}`,
    description: null,
    language: null,
    stargazers_count: 0,
    forks_count: 0,
    size: 0,
    updated_at: new Date().toISOString(),
    default_branch: "main",
  };

  try {
    // Try to read README for description
    const readmeFiles = ["README.md", "README.txt", "README.rst", "README"];
    for (const readmeFile of readmeFiles) {
      try {
        const readmePath = path.join(repoPath, readmeFile);
        const readmeContent = await fs.readFile(readmePath, "utf-8");
        // Extract first line or first paragraph as description
        const lines = readmeContent.split("\n").filter((line) => line.trim());
        if (lines.length > 0) {
          let description = lines[0].replace(/^#+\s*/, "").trim(); // Remove markdown headers
          if (description.length > 100) {
            description = description.substring(0, 97) + "...";
          }
          repoInfo.description = description;
          break;
        }
      } catch {
        // Continue to next README file
      }
    }

    // Try to detect primary language from file extensions
    const files = await _walkDirectory(repoPath, repoPath);
    const languageCount: Record<string, number> = {};

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      const language = getLanguageFromExtension(ext);
      if (language) {
        languageCount[language] = (languageCount[language] || 0) + 1;
      }
    }

    // Find most common language
    if (Object.keys(languageCount).length > 0) {
      const topLanguage = Object.entries(languageCount).sort(
        ([, a], [, b]) => b - a,
      )[0][0];
      repoInfo.language = topLanguage;
    }

    // Get repository size (approximate)
    try {
      // Use cross-platform approach for getting directory size
      if (process.platform === 'win32' || process.env.VERCEL || process.env.NETLIFY) {
        // On Windows or serverless environments, calculate size manually
        const calculateDirectorySize = async (dirPath: string): Promise<number> => {
          let totalSize = 0;
          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name);
              if (entry.isDirectory()) {
                totalSize += await calculateDirectorySize(fullPath);
              } else {
                const stats = await fs.stat(fullPath);
                totalSize += stats.size;
              }
            }
          } catch (error) {
            console.warn(`Error calculating size for ${dirPath}:`, error);
          }
          return totalSize;
        };
        repoInfo.size = await calculateDirectorySize(repoPath);
      } else {
        // Unix-like systems
        const { stdout } = await execAsync("du -sh .", {
          cwd: repoPath,
          timeout: 10000,
        });
        const sizeMatch = stdout.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?)/);
        if (sizeMatch) {
          const [, size, unit] = sizeMatch;
          const multipliers = {
            "": 1,
            K: 1024,
            M: 1024 * 1024,
            G: 1024 * 1024 * 1024,
            T: 1024 * 1024 * 1024 * 1024,
          };
          repoInfo.size = Math.round(
            parseFloat(size) *
              (multipliers[unit as keyof typeof multipliers] || 1),
          );
        }
      }
    } catch (error) {
      console.warn("Size calculation failed:", error);
      // Size calculation failed, keep default 0
    }
  } catch (error) {
    console.warn(
      "Error extracting repository metadata from filesystem:",
      error,
    );
  }

  return repoInfo;
};

/**
 * Maps file extensions to programming languages
 * @private
 */
const getLanguageFromExtension = (ext: string): string | null => {
  const languageMap: Record<string, string> = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".py": "Python",
    ".java": "Java",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C",
    ".cs": "C#",
    ".php": "PHP",
    ".rb": "Ruby",
    ".go": "Go",
    ".rs": "Rust",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".sql": "SQL",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".sh": "Shell",
    ".bat": "Batch",
    ".ps1": "PowerShell",
    ".r": "R",
    ".m": "MATLAB",
    ".scala": "Scala",
    ".clj": "Clojure",
    ".hs": "Haskell",
    ".elm": "Elm",
    ".dart": "Dart",
    ".lua": "Lua",
    ".pl": "Perl",
    ".vim": "Vim script",
  };

  return languageMap[ext] || null;
};

/**
 * Creates a temporary directory for cloning
 * @private
 */
const _createTempDir = async (prefix: string): Promise<string> => {
  const tempDir = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );
  await fs.mkdir(tempDir, { recursive: true });
  console.log(`📁 Created temporary directory: ${tempDir}`);
  return tempDir;
};

/**
 * Checks if git is available on the system
 * @private
 */
const _checkGitAvailability = async (): Promise<boolean> => {
  // Skip git check in serverless environments where it's typically not available
  if (process.env.VERCEL || process.env.NETLIFY || process.env.DISABLE_GIT) {
    console.log("Skipping git availability check in serverless environment");
    return false;
  }
  
  try {
    await execAsync("git --version", { timeout: 5000 });
    console.log("Git is available for repository cloning");
    return true;
  } catch (error) {
    console.warn("Git is not available on the system, will use ZIP download fallback:", error);
    return false;
  }
};

/**
 * Downloads and extracts GitHub repository using ZIP archive API
 * This is a fallback method when git is not available
 * @private
 */
const _downloadAndExtractZip = async (
  owner: string,
  repo: string,
  tempDir: string,
  branch: string = "main"
): Promise<string> => {
  const repoPath = path.join(tempDir, repo);
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
  
  console.log(`Downloading repository ${owner}/${repo} as ZIP from ${zipUrl}...`);

  try {
    // Download the ZIP file
    const response = await fetch(zipUrl);
    
    if (!response.ok) {
      // Try with 'master' branch if 'main' fails
      if (branch === "main") {
        console.log(`Branch 'main' not found, trying 'master'...`);
        return await _downloadAndExtractZip(owner, repo, tempDir, "master");
      }
      throw new Error(`Failed to download repository: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    console.log(`Extracting ZIP archive to ${repoPath}...`);
    await fs.mkdir(repoPath, { recursive: true });

    // Extract all files from the ZIP
    const promises: Promise<void>[] = [];
    
    zip.forEach((relativePath, file) => {
      // Skip the root directory (usually repo-name-branch/)
      const pathParts = relativePath.split('/');
      if (pathParts.length <= 1) return;
      
      // Remove the first part (root directory) to get the actual file path
      const actualPath = pathParts.slice(1).join('/');
      if (!actualPath) return;
      
      const fullPath = path.join(repoPath, actualPath);
      
      if (file.dir) {
        // Create directory
        promises.push(fs.mkdir(fullPath, { recursive: true }).then(() => {}));
      } else {
        // Extract file
        promises.push(
          file.async('nodebuffer').then(async (content) => {
            const dirPath = path.dirname(fullPath);
            await fs.mkdir(dirPath, { recursive: true });
            await fs.writeFile(fullPath, content);
          })
        );
      }
    });

    await Promise.all(promises);
    console.log(`Successfully extracted repository to ${repoPath}`);
    return repoPath;
    
  } catch (error) {
    console.error(`Failed to download/extract ZIP:`, error);
    throw new Error(
      `Failed to download repository ${owner}/${repo} as ZIP: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Downloads a GitHub repository to a temporary directory
 * Uses git clone if available, otherwise falls back to ZIP download
 * @private
 */
const _downloadRepository = async (
  owner: string,
  repo: string,
  tempDir: string,
): Promise<string> => {
  console.log(`Downloading repository ${owner}/${repo}...`);

  // Check if git is available
  const gitAvailable = await _checkGitAvailability();
  
  if (gitAvailable) {
    console.log("Using git clone method...");
    return await _cloneWithGit(owner, repo, tempDir);
  } else {
    console.log("Git not available, using ZIP download method...");
    return await _downloadAndExtractZip(owner, repo, tempDir);
  }
};

/**
 * Clones a GitHub repository using git (original method)
 * @private
 */
const _cloneWithGit = async (
  owner: string,
  repo: string,
  tempDir: string,
): Promise<string> => {
  const repoPath = path.join(tempDir, repo);
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;

  console.log(`Cloning repository ${owner}/${repo} to ${repoPath}...`);

  try {
    // Use git clone with depth 1 for faster cloning (only latest commit)
    const cloneCommand = `git clone --depth 1 "${cloneUrl}" "${repoPath}"`;
    await execAsync(cloneCommand, { timeout: 300000 }); // 5 minute timeout

    console.log(`Successfully cloned repository to ${repoPath}`);
    return repoPath;
  } catch (error) {
    console.error(`Failed to clone repository:`, error);
    throw new Error(
      `Failed to clone repository ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Recursively walks through directory and finds processable files
 * @private
 */
const _walkDirectory = async (
  dirPath: string,
  basePath: string,
): Promise<string[]> => {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }

        // Recursively walk subdirectories
        const subFiles = await _walkDirectory(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Check if file should be processed
        const stats = await fs.stat(fullPath);

        // Skip large files
        if (stats.size > MAX_FILE_SIZE) {
          console.log(
            `Skipping large file: ${relativePath} (${stats.size} bytes)`,
          );
          continue;
        }

        // Check file extension or name
        const fileName = entry.name.toLowerCase();
        const extension = fileName.includes(".")
          ? "." + fileName.split(".").pop()
          : fileName;

        if (
          PROCESSABLE_EXTENSIONS.has(extension) ||
          PROCESSABLE_EXTENSIONS.has(fileName)
        ) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Error walking directory ${dirPath}:`, error);
  }

  return files;
};

/**
 * Reads file content from filesystem
 * @private
 */
const _readFileContent = async (filePath: string): Promise<string | null> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
    return null;
  }
};

/**
 * Processes repository files from filesystem and creates documents
 * @private
 */
const _processRepositoryFilesFromFS = async (
  repoPath: string,
  owner: string,
  repo: string,
  repositoryUrl: string,
): Promise<Document[]> => {
  console.log(`Processing files from cloned repository at ${repoPath}...`);

  // Get all processable files
  const files = await _walkDirectory(repoPath, repoPath);
  console.log(`Found ${files.length} processable files`);

  const documents: Document[] = [];
  let processedCount = 0;

  for (const filePath of files) {
    try {
      const content = await _readFileContent(filePath);
      if (!content || content.trim().length === 0) {
        continue;
      }

      // Get relative path for metadata
      const relativePath = path
        .relative(repoPath, filePath)
        .replace(/\\/g, "/");
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath);

      // Get file stats
      const stats = await fs.stat(filePath);

      // Create document with rich metadata
      const document = new Document({
        pageContent: content,
        metadata: {
          source: repositoryUrl,
          type: "github",
          repository: `${owner}/${repo}`,
          filePath: relativePath,
          fileName: fileName,
          fileExtension: fileExtension,
          fileSize: stats.size,
          url: `https://github.com/${owner}/${repo}/blob/main/${relativePath}`,
          lastModified: stats.mtime.toISOString(),
        },
      });

      documents.push(document);
      processedCount++;

      if (processedCount % 25 === 0) {
        console.log(`Processed ${processedCount}/${files.length} files...`);
      }
    } catch (error) {
      console.warn(`Failed to process file ${filePath}:`, error);
    }
  }

  console.log(
    `Successfully processed ${documents.length} files from filesystem`,
  );
  return documents;
};

/**
 * Cleans up temporary directory
 * @private
 */
const _cleanupTempDir = async (tempDir: string): Promise<void> => {
  try {
    console.log(`Starting cleanup of temporary directory: ${tempDir}`);

    // Check if directory exists before attempting cleanup
    try {
      await fs.access(tempDir);
    } catch {
      console.log(
        `Temporary directory ${tempDir} does not exist, no cleanup needed`,
      );
      return;
    }

    // On Windows, sometimes files might be locked by antivirus or other processes
    // Try multiple attempts with small delays
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        await fs.rm(tempDir, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
        console.log(
          `✅ Successfully cleaned up temporary directory: ${tempDir}`,
        );
        return;
      } catch (error) {
        attempts++;
        console.warn(
          `Cleanup attempt ${attempts}/${maxAttempts} failed for ${tempDir}:`,
          error,
        );

        if (attempts < maxAttempts) {
          // Wait a bit before retrying (in case files are temporarily locked)
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // If all attempts failed, log a warning but don't throw
    console.error(
      `❌ Failed to cleanup temporary directory ${tempDir} after ${maxAttempts} attempts. Manual cleanup may be required.`,
    );
  } catch (error) {
    console.error(`Unexpected error during cleanup of ${tempDir}:`, error);
  }
};

/**
 * Splits documents into chunks for vector storage
 * @private
 */
const _splitDocuments = async (documents: Document[]): Promise<Document[]> => {
  console.log(`Splitting ${documents.length} documents into chunks...`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ["\n\n", "\n", " ", ""], // Prioritize natural breaks
  });

  const chunkedDocs = await splitter.splitDocuments(documents);
  console.log(`Documents split into ${chunkedDocs.length} chunks`);
  return chunkedDocs;
};

/**
 * Creates embeddings and stores document chunks in Pinecone
 * @private
 */
const _storeDocsInPinecone = async (
  docs: Document[],
  namespace: string,
): Promise<void> => {
  console.log("Creating Gemini embeddings...");
  const embeddings = await createGeminiEmbeddings();
  if (!embeddings) {
    throw new Error(
      "Failed to create embeddings. Gemini API may not be configured properly.",
    );
  }

  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    throw new Error("Pinecone index is not initialized.");
  }

  console.log(
    `Storing ${docs.length} chunks in Pinecone with namespace: ${namespace}...`,
  );
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // Process in batches to avoid overwhelming Pinecone
      const batchSize = 100;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        console.log(
          `Storing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(docs.length / batchSize)}...`,
        );

        await PineconeStore.fromDocuments(batch, embeddings, {
          pineconeIndex,
          namespace,
        });

        // Small delay between batches
        if (i + batchSize < docs.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log("Successfully stored all repository chunks in Pinecone.");
      return;
    } catch (error) {
      retries++;
      console.error(
        `Error storing in Pinecone (attempt ${retries}/${MAX_RETRIES}):`,
        error,
      );
      if (retries >= MAX_RETRIES) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * retries),
      );
    }
  }
};

/**
 * Main function to process a GitHub repository by downloading it locally
 * Uses git clone if available, otherwise falls back to ZIP download
 *
 * @param repositoryUrl The URL of the GitHub repository
 * @param namespace The unique ID (and Pinecone namespace) for the file
 * @returns A promise that resolves with the outcome of the processing
 */
export const processGitHubRepositoryWithClone = async (
  repositoryUrl: string,
  namespace: string,
): Promise<TypeGitHubProcessResult> => {
  console.log(
    `Starting GitHub repository processing with clone for namespace: ${namespace}`,
  );

  if (!(await isPineconeConfigured())) {
    throw new Error(
      "Pinecone is not configured. Please check environment variables.",
    );
  }

  const supabase = supabaseBrowserClient();
  const parsedRepo = _parseGitHubUrl(repositoryUrl);

  if (!parsedRepo) {
    throw new Error(
      "Invalid GitHub URL. Could not extract repository information.",
    );
  }

  const { owner, repo } = parsedRepo;
  let tempDir: string | null = null;
  let repoPath: string | null = null;

  try {
    await updateFileStatus(supabase, namespace, "processing");

    // Step 1: Check if git is available first
    const gitAvailable = await _checkGitAvailability();
    if (!gitAvailable) {
      throw new Error("CLONE_UNAVAILABLE: Git is not available on the system");
    }

    // Step 2: Create temporary directory and download repository
    tempDir = await _createTempDir(`inquora-repo-${owner}-${repo}`);
    repoPath = await _downloadRepository(owner, repo, tempDir);

    // Step 3: Extract repository information from filesystem
    if (!repoPath) {
      throw new Error("Repository download failed - no path returned");
    }
    const repositoryInfo = await _extractRepositoryInfoFromFS(
      repoPath,
      owner,
      repo,
    );
    console.log(`Repository: ${repositoryInfo.full_name}`);
    console.log(
      `Description: ${repositoryInfo.description || "No description"}`,
    );
    console.log(`Language: ${repositoryInfo.language || "Unknown"}`);

    // Step 4: Process files from filesystem
    const documents = await _processRepositoryFilesFromFS(
      repoPath,
      owner,
      repo,
      repositoryUrl,
    );

    if (documents.length === 0) {
      throw new Error(
        "No content could be extracted from the repository files.",
      );
    }

    // Step 5: Split documents into chunks
    const chunkedDocs = await _splitDocuments(documents);

    // Step 6: Store in Pinecone
    await _storeDocsInPinecone(chunkedDocs, namespace);

    // Step 7: Update file status with summary information
    const wasGitUsed = await _checkGitAvailability();
    const processingMethod = wasGitUsed ? "Git clone (filesystem)" : "ZIP download (filesystem)";
    
    const repositorySummary = [
      `Repository: ${repositoryInfo.full_name}`,
      `Description: ${repositoryInfo.description || "No description available"}`,
      `Language: ${repositoryInfo.language || "Unknown"}`,
      `Stars: ${repositoryInfo.stargazers_count}`,
      `Forks: ${repositoryInfo.forks_count}`,
      `Files processed: ${documents.length}`,
      `Chunks created: ${chunkedDocs.length}`,
      `Last updated: ${repositoryInfo.updated_at}`,
      `Processing method: ${processingMethod}`,
      `Temporary files: Will be cleaned up automatically`,
    ].join("\n");

    await updateFileStatus(supabase, namespace, "completed", {
      indexedChunks: chunkedDocs.length,
      fullText: repositorySummary,
    });

    return { numDocs: chunkedDocs.length, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Repository processing failed for namespace ${namespace}:`,
      errorMessage,
    );

    // Check if this is a recoverable error that should trigger API fallback
    const isRecoverableError = (
      errorMessage.includes("CLONE_UNAVAILABLE") ||
      errorMessage.includes("Failed to clone") ||
      errorMessage.includes("Failed to download") ||
      errorMessage.includes("git: command not found") ||
      errorMessage.includes("Git is not available")
    );

    if (isRecoverableError) {
      console.log("Repository processing error is recoverable, will trigger API fallback");
      throw error; // Re-throw to trigger fallback mechanism
    }

    // For non-recoverable errors, mark as failed
    await updateFileStatus(supabase, namespace, "failed", {
      error: errorMessage,
    });
    return { numDocs: 0, success: false, error: errorMessage };
  } finally {
    // Always cleanup temporary directory
    if (tempDir) {
      console.log(
        `🧹 Cleaning up temporary files for repository processing...`,
      );
      await _cleanupTempDir(tempDir);
    }
  }
};

/**
 * Retrieves basic information about a GitHub repository without processing
 *
 * @param repositoryUrl The URL of the GitHub repository
 * @returns A promise that resolves to the repository's information
 */
export const getGitHubRepositoryInfo = async (
  repositoryUrl: string,
): Promise<TypeGitHubRepositoryInfo> => {
  const parsedRepo = _parseGitHubUrl(repositoryUrl);

  if (!parsedRepo) {
    throw new Error(
      "Invalid GitHub URL. Could not extract repository information.",
    );
  }

  const { owner, repo } = parsedRepo;
  let tempDir: string | null = null;
  let repoPath: string | null = null;

  try {
    // Check if git is available
    const gitAvailable = await _checkGitAvailability();
    if (!gitAvailable) {
      throw new Error(
        "Git is not available on the system. Cannot retrieve repository information.",
      );
    }

    // Download repository to temporary location
    tempDir = await _createTempDir(`inquora-info-${owner}-${repo}`);
    repoPath = await _downloadRepository(owner, repo, tempDir);

    // Extract repository information from filesystem
    if (!repoPath) {
      throw new Error("Repository download failed - no path returned");
    }
    const repositoryInfo = await _extractRepositoryInfoFromFS(
      repoPath,
      owner,
      repo,
    );

    return {
      name: repositoryInfo.name,
      fullName: repositoryInfo.full_name,
      description: repositoryInfo.description,
      language: repositoryInfo.language,
      stars: repositoryInfo.stargazers_count,
      forks: repositoryInfo.forks_count,
      size: repositoryInfo.size,
      lastUpdate: repositoryInfo.updated_at,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch repository information: ${errorMessage}`);
  } finally {
    // Always cleanup temporary directory
    if (tempDir) {
      console.log(
        `🧹 Cleaning up temporary files for repository info extraction...`,
      );
      await _cleanupTempDir(tempDir);
    }
  }
};

/**
 * Cleans up any orphaned temporary directories created by this processor
 * This can be called periodically to clean up any directories that might have been left behind
 * @public
 */
export const cleanupOrphanedTempDirectories = async (): Promise<void> => {
  try {
    const tempBaseDir = os.tmpdir();
    const entries = await fs.readdir(tempBaseDir, { withFileTypes: true });

    const inquoraTempDirs = entries.filter(
      (entry) =>
        entry.isDirectory() &&
        (entry.name.startsWith("inquora-repo-") ||
          entry.name.startsWith("inquora-info-")),
    );

    if (inquoraTempDirs.length === 0) {
      console.log("No orphaned Inquora temporary directories found");
      return;
    }

    console.log(
      `Found ${inquoraTempDirs.length} potential orphaned temporary directories`,
    );

    for (const dir of inquoraTempDirs) {
      const fullPath = path.join(tempBaseDir, dir.name);
      try {
        // Check if directory is older than 1 hour (indicating it might be orphaned)
        const stats = await fs.stat(fullPath);
        const ageInMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);

        if (ageInMinutes > 60) {
          console.log(
            `Cleaning up orphaned directory: ${dir.name} (age: ${Math.round(ageInMinutes)} minutes)`,
          );
          await _cleanupTempDir(fullPath);
        } else {
          console.log(
            `Skipping recent directory: ${dir.name} (age: ${Math.round(ageInMinutes)} minutes)`,
          );
        }
      } catch (error) {
        console.warn(`Error processing directory ${dir.name}:`, error);
      }
    }
  } catch (error) {
    console.error("Error during orphaned directory cleanup:", error);
  }
};

/**
 * Validates if a URL is a valid GitHub repository URL
 *
 * @param url The URL to validate
 * @returns True if the URL is a valid GitHub repository URL
 */
export const isValidGitHubUrl = async (url: string): Promise<boolean> => {
  const parsed = _parseGitHubUrl(url);
  return parsed !== null;
};

/**
 * Extracts the repository identifier from a GitHub URL
 *
 * @param url The GitHub repository URL
 * @returns The repository identifier in the format "owner/repo"
 */
export const extractGitHubRepoId = async (
  url: string,
): Promise<string | null> => {
  const parsed = _parseGitHubUrl(url);
  return parsed ? `${parsed.owner}/${parsed.repo}` : null;
};
