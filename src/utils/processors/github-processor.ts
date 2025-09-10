"use server";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";
import { supabaseBrowserClient } from "../supabase/client";
import { updateFileStatus } from "../file-processing-utils";
import type {
  TypeGitHubTreeItem,
  TypeGitHubRepository,
  TypeGitHubRepositoryInfo,
  TypeGitHubProcessResult,
  TypeGitHubParseResult,
} from "@/types/TypeGitHub";

// --- Constants ---
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit per file
const GITHUB_API_BASE = "https://api.github.com";
const RATE_LIMIT_DELAY = 100; // 100ms between API calls

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
 * Makes authenticated GitHub API requests with rate limiting
 * @private
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _makeGitHubApiRequest = async (
  url: string,
  options: RequestInit = {},
): Promise<any> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Inquora-GitHub-Processor",
  };

  // Add any additional headers from options
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // Add authentication if available
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }

  console.log(`Making GitHub API request to: ${url}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 403) {
      const resetTime = response.headers.get("X-RateLimit-Reset");
      const remaining = response.headers.get("X-RateLimit-Remaining");
      throw new Error(
        `GitHub API rate limit exceeded. Reset at: ${resetTime}, Remaining: ${remaining}`,
      );
    }
    if (response.status === 404) {
      throw new Error(
        `Repository not found or is private. Make sure the repository exists and is accessible.`,
      );
    }
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};

/**
 * Fetches repository information
 * @private
 */
const _fetchRepositoryInfo = async (
  owner: string,
  repo: string,
): Promise<TypeGitHubRepository> => {
  console.log(`Fetching repository info for ${owner}/${repo}...`);

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
  return _makeGitHubApiRequest(url);
};

/**
 * Fetches the repository tree (file structure)
 * @private
 */
const _fetchRepositoryTree = async (
  owner: string,
  repo: string,
  sha: string = "HEAD",
): Promise<TypeGitHubTreeItem[]> => {
  console.log(`Fetching repository tree for ${owner}/${repo}...`);

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
  const response = await _makeGitHubApiRequest(url);
  return response.tree || [];
};

/**
 * Fetches file content from GitHub
 * @private
 */
const _fetchFileContent = async (
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> => {
  try {
    console.log(`Fetching content for: ${path}`);

    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const response = await _makeGitHubApiRequest(url);

    if (response.content && response.encoding === "base64") {
      const content = Buffer.from(response.content, "base64").toString("utf-8");
      console.log(
        `Successfully fetched ${content.length} characters from ${path}`,
      );
      return content;
    }

    console.warn(`No content or unsupported encoding for: ${path}`);
    return null;
  } catch (error) {
    console.warn(`Failed to fetch content for ${path}:`, error);
    return null;
  }
};

/**
 * Filters processable files from the repository tree
 * @private
 */
const _filterProcessableFiles = (
  tree: TypeGitHubTreeItem[],
): TypeGitHubTreeItem[] => {
  console.log(`Filtering ${tree.length} items from repository tree...`);

  const processableFiles = tree.filter((item) => {
    // Only process files (blobs), not directories
    if (item.type !== "blob") return false;

    // Skip large files
    if (item.size && item.size > MAX_FILE_SIZE) {
      console.log(`Skipping large file: ${item.path} (${item.size} bytes)`);
      return false;
    }

    // Check if file is in a skipped directory
    const pathParts = item.path.split("/");
    if (pathParts.some((part) => SKIP_DIRECTORIES.has(part))) {
      return false;
    }

    // Check file extension or name
    const fileName = pathParts[pathParts.length - 1].toLowerCase();
    const extension = fileName.includes(".")
      ? "." + fileName.split(".").pop()
      : fileName;

    return (
      PROCESSABLE_EXTENSIONS.has(extension) ||
      PROCESSABLE_EXTENSIONS.has(fileName)
    );
  });

  console.log(`Filtered to ${processableFiles.length} processable files`);
  return processableFiles;
};

/**
 * Processes repository files and creates documents
 * @private
 */
const _processRepositoryFiles = async (
  owner: string,
  repo: string,
  files: TypeGitHubTreeItem[],
  repositoryUrl: string,
): Promise<Document[]> => {
  console.log(`Processing ${files.length} files from repository...`);

  const documents: Document[] = [];
  let processedCount = 0;

  for (const file of files) {
    try {
      // Rate limiting
      if (processedCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
      }

      const content = await _fetchFileContent(owner, repo, file.path);
      if (!content || content.trim().length === 0) {
        continue;
      }

      // Create document with rich metadata
      const document = new Document({
        pageContent: content,
        metadata: {
          source: repositoryUrl,
          type: "github",
          repository: `${owner}/${repo}`,
          filePath: file.path,
          fileName: file.path.split("/").pop() || file.path,
          fileExtension: file.path.includes(".")
            ? "." + file.path.split(".").pop()
            : "",
          fileSize: file.size || 0,
          sha: file.sha,
          url: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
        },
      });

      documents.push(document);
      processedCount++;

      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${files.length} files...`);
      }
    } catch (error) {
      console.warn(`Failed to process file ${file.path}:`, error);
    }
  }

  console.log(`Successfully processed ${documents.length} files`);
  return documents;
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
 * Main function to process a GitHub repository
 *
 * @param repositoryUrl The URL of the GitHub repository
 * @param namespace The unique ID (and Pinecone namespace) for the file
 * @returns A promise that resolves with the outcome of the processing
 */
export const processGitHubRepository = async (
  repositoryUrl: string,
  namespace: string,
): Promise<TypeGitHubProcessResult> => {
  console.log(
    `Starting GitHub repository processing for namespace: ${namespace}`,
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

  try {
    await updateFileStatus(supabase, namespace, "processing");

    // Step 1: Fetch repository information
    const repositoryInfo = await _fetchRepositoryInfo(owner, repo);
    console.log(`Repository: ${repositoryInfo.full_name}`);
    console.log(
      `Description: ${repositoryInfo.description || "No description"}`,
    );
    console.log(`Language: ${repositoryInfo.language || "Unknown"}`);
    console.log(`Stars: ${repositoryInfo.stargazers_count}`);

    // Step 2: Fetch repository tree
    const tree = await _fetchRepositoryTree(
      owner,
      repo,
      repositoryInfo.default_branch,
    );

    // Step 3: Filter processable files
    const processableFiles = _filterProcessableFiles(tree);

    if (processableFiles.length === 0) {
      throw new Error("No processable files found in the repository.");
    }

    // Step 4: Process files and create documents
    const documents = await _processRepositoryFiles(
      owner,
      repo,
      processableFiles,
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
    const repositorySummary = [
      `Repository: ${repositoryInfo.full_name}`,
      `Description: ${repositoryInfo.description || "No description available"}`,
      `Language: ${repositoryInfo.language || "Unknown"}`,
      `Stars: ${repositoryInfo.stargazers_count}`,
      `Forks: ${repositoryInfo.forks_count}`,
      `Files processed: ${documents.length}/${processableFiles.length}`,
      `Chunks created: ${chunkedDocs.length}`,
      `Last updated: ${repositoryInfo.updated_at}`,
      `Processing method: API-based (fallback)`,
    ].join("\n");

    await updateFileStatus(supabase, namespace, "completed", {
      indexedChunks: chunkedDocs.length,
      fullText: repositorySummary,
    });

    return { numDocs: chunkedDocs.length, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Processing failed for namespace ${namespace}:`,
      errorMessage,
    );

    await updateFileStatus(supabase, namespace, "failed", {
      error: errorMessage,
    });

    return { numDocs: 0, success: false, error: errorMessage };
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

  try {
    const repositoryInfo = await _fetchRepositoryInfo(owner, repo);

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
