"use server";

/**
 * Consolidated GitHub Repository Processor
 * 
 * Single file handling all GitHub repository processing with fallback strategy:
 * 1. Git Clone (if available) - Fastest, full access
 * 2. ZIP Download - Fallback when git unavailable
 * 3. GitHub API - Final fallback, uses API quota
 * 
 * Uses shared utilities from github-processor-utils.ts
 */

import { Document } from "@langchain/core/documents";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import JSZip from "jszip";
import { supabaseServerClient } from "@/data/supabase/server";
import { updateFileStatus } from "../file-processing-utils";
import { isPineconeConfigured } from "../pinecone";
import type {
    TypeGitHubProcessResult,
    TypeGitHubRepositoryInfo,
    TypeGitHubParseResult,
} from "@/types/github";
import {
    parseGitHubUrl,
    splitDocuments,
    storeDocsInPinecone,
    PROCESSABLE_EXTENSIONS,
    SKIPPED_DIRECTORIES,
    GITHUB_MAX_FILE_SIZE,
} from "./github-processor-utils";

const execAsync = promisify(exec);

const GITHUB_API_BASE = "https://api.github.com";
const RATE_LIMIT_DELAY = 100;

/**
 * Checks if git is available on the system
 */
async function checkGitAvailability(): Promise<boolean> {
    if (process.env.VERCEL || process.env.NETLIFY || process.env.DISABLE_GIT) {
        return false;
    }

    try {
        await execAsync("git --version", { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * Creates a temporary directory
 */
async function createTempDir(prefix: string): Promise<string> {
    const tempDir = path.join(
        os.tmpdir(),
        `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}

/**
 * Clones repository using git
 */
async function cloneWithGit(owner: string, repo: string, tempDir: string): Promise<string> {
    const repoPath = path.join(tempDir, repo);
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;

    const cloneCommand = `git clone --depth 1 "${cloneUrl}" "${repoPath}"`;
    await execAsync(cloneCommand, { timeout: 300000 });

    return repoPath;
}

/**
 * Downloads and extracts repository using ZIP
 */
async function downloadAndExtractZip(
    owner: string,
    repo: string,
    tempDir: string,
    branch: string = "main"
): Promise<string> {
    const repoPath = path.join(tempDir, repo);
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

    const response = await fetch(zipUrl);

    if (!response.ok) {
        if (branch === "main") {
            return downloadAndExtractZip(owner, repo, tempDir, "master");
        }
        throw new Error(`Failed to download: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    await fs.mkdir(repoPath, { recursive: true });

    const promises: Promise<void>[] = [];
    zip.forEach((relativePath, file) => {
        const pathParts = relativePath.split("/");
        if (pathParts.length <= 1) return;

        const actualPath = pathParts.slice(1).join("/");
        if (!actualPath) return;

        const fullPath = path.join(repoPath, actualPath);

        if (file.dir) {
            promises.push(fs.mkdir(fullPath, { recursive: true }).then(() => { }));
        } else {
            promises.push(
                file.async("nodebuffer").then(async (content) => {
                    await fs.mkdir(path.dirname(fullPath), { recursive: true });
                    await fs.writeFile(fullPath, content);
                })
            );
        }
    });

    await Promise.all(promises);
    return repoPath;
}

/**
 * Walks directory and finds processable files
 */
async function walkDirectory(dirPath: string, basePath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
            const subFiles = await walkDirectory(fullPath, basePath);
            files.push(...subFiles);
        } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            if (stats.size > GITHUB_MAX_FILE_SIZE) continue;

            const fileName = entry.name.toLowerCase();
            const extension = fileName.includes(".") ? "." + fileName.split(".").pop() : fileName;

            if (PROCESSABLE_EXTENSIONS.has(extension) || PROCESSABLE_EXTENSIONS.has(fileName)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

/**
 * Processes files from filesystem into documents
 */
async function processFilesFromFS(
    repoPath: string,
    owner: string,
    repo: string,
    repositoryUrl: string
): Promise<Document[]> {
    const filePaths = await walkDirectory(repoPath, repoPath);
    const documents: Document[] = [];

    for (const filePath of filePaths) {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            if (!content || content.trim().length === 0) continue;

            const relativePath = path.relative(repoPath, filePath).replace(/\\/g, "/");

            documents.push(new Document({
                pageContent: content,
                metadata: {
                    source: repositoryUrl,
                    type: "github",
                    repository: `${owner}/${repo}`,
                    filePath: relativePath,
                    fileName: path.basename(filePath),
                    url: `https://github.com/${owner}/${repo}/blob/main/${relativePath}`,
                },
            }));
        } catch {
            // Skip unreadable files
        }
    }

    return documents;
}

/**
 * Cleans up temporary directory
 */
async function cleanupTempDir(tempDir: string): Promise<void> {
    try {
        await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
        // Ignore cleanup errors
    }
}

/**
 * Makes authenticated GitHub API request
 */
async function makeGitHubApiRequest(url: string): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Inquora-App",
    };

    if (process.env.GITHUB_TOKEN) {
        headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Processes repository using GitHub API (final fallback)
 */
async function processWithAPI(
    owner: string,
    repo: string,
    repositoryUrl: string
): Promise<Document[]> {
    const treeData = await makeGitHubApiRequest(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    ) as { tree: Array<{ path: string; type: string; size?: number }> };

    const files = treeData.tree.filter((item) => {
        if (item.type !== "blob") return false;
        if ((item.size || 0) > GITHUB_MAX_FILE_SIZE) return false;

        const ext = "." + item.path.split(".").pop()?.toLowerCase();
        return PROCESSABLE_EXTENSIONS.has(ext);
    });

    const documents: Document[] = [];

    for (const file of files.slice(0, 100)) {
        try {
            const fileData = await makeGitHubApiRequest(
                `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`
            ) as { content?: string };

            if (fileData.content) {
                const content = Buffer.from(fileData.content, "base64").toString("utf-8");
                documents.push(new Document({
                    pageContent: content,
                    metadata: {
                        source: repositoryUrl,
                        type: "github",
                        repository: `${owner}/${repo}`,
                        filePath: file.path,
                        url: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
                    },
                }));
            }
        } catch {
            // Skip files that fail to fetch
        }
    }

    return documents;
}

/**
 * Main function: Processes a GitHub repository with automatic fallback
 * Order: Git Clone → ZIP Download → GitHub API
 */
export async function processGitHubRepository(
    repositoryUrl: string,
    namespace: string
): Promise<TypeGitHubProcessResult> {
    if (!(await isPineconeConfigured())) {
        throw new Error("Pinecone is not configured.");
    }

    const parsed = parseGitHubUrl(repositoryUrl);
    if (!parsed) {
        throw new Error("Invalid GitHub URL.");
    }

    const { owner, repo } = parsed;
    const supabase = await supabaseServerClient();
    let tempDir: string | null = null;
    const errors: string[] = [];

    try {
        await updateFileStatus(supabase, namespace, "processing");

        let documents: Document[] = [];

        // Method 1: Try Git Clone
        const gitAvailable = await checkGitAvailability();
        if (gitAvailable) {
            try {
                tempDir = await createTempDir(`github-${owner}-${repo}`);
                const repoPath = await cloneWithGit(owner, repo, tempDir);
                documents = await processFilesFromFS(repoPath, owner, repo, repositoryUrl);
            } catch (error) {
                errors.push(`Git clone: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Method 2: Try ZIP Download
        if (documents.length === 0) {
            try {
                if (!tempDir) tempDir = await createTempDir(`github-${owner}-${repo}`);
                const repoPath = await downloadAndExtractZip(owner, repo, tempDir);
                documents = await processFilesFromFS(repoPath, owner, repo, repositoryUrl);
            } catch (error) {
                errors.push(`ZIP download: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Method 3: Try GitHub API (final fallback)
        if (documents.length === 0) {
            try {
                documents = await processWithAPI(owner, repo, repositoryUrl);
            } catch (error) {
                errors.push(`API: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (documents.length === 0) {
            throw new Error(`All methods failed:\n${errors.join("\n")}`);
        }

        // Split and store documents
        const chunks = await splitDocuments(documents);
        await storeDocsInPinecone(chunks, namespace);

        await updateFileStatus(supabase, namespace, "completed", {
            indexedChunks: chunks.length,
            fullText: `Processed ${documents.length} files, ${chunks.length} chunks from ${owner}/${repo}`,
        });

        return { numDocs: chunks.length, success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await updateFileStatus(supabase, namespace, "failed", { error: errorMessage });
        return { numDocs: 0, success: false, error: errorMessage };
    } finally {
        if (tempDir) await cleanupTempDir(tempDir);
    }
}

/**
 * Gets repository information
 */
export async function getGitHubRepositoryInfo(
    repositoryUrl: string
): Promise<TypeGitHubRepositoryInfo> {
    const parsed = parseGitHubUrl(repositoryUrl);
    if (!parsed) throw new Error("Invalid GitHub URL.");

    const { owner, repo } = parsed;

    try {
        const data = await makeGitHubApiRequest(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}`
        ) as {
            name: string;
            full_name: string;
            description: string | null;
            language: string | null;
            stargazers_count: number;
            forks_count: number;
            size: number;
            updated_at: string;
        };

        return {
            name: data.name,
            fullName: data.full_name,
            description: data.description,
            language: data.language,
            stars: data.stargazers_count,
            forks: data.forks_count,
            size: data.size,
            lastUpdate: data.updated_at,
        };
    } catch (error) {
        throw new Error(`Failed to fetch repository info: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Validates GitHub URL
 */
export async function isValidGitHubUrl(url: string): Promise<boolean> {
    return parseGitHubUrl(url) !== null;
}

/**
 * Extracts repository ID from URL
 */
export async function extractGitHubRepoId(url: string): Promise<string | null> {
    const parsed = parseGitHubUrl(url);
    return parsed ? `${parsed.owner}/${parsed.repo}` : null;
}

/**
 * Cleans up orphaned temp directories
 */
export async function cleanupOrphanedTempDirectories(): Promise<void> {
    try {
        const tempBase = os.tmpdir();
        const entries = await fs.readdir(tempBase, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith("github-")) {
                const fullPath = path.join(tempBase, entry.name);
                const stats = await fs.stat(fullPath);
                const ageMinutes = (Date.now() - stats.mtime.getTime()) / 60000;

                if (ageMinutes > 60) {
                    await cleanupTempDir(fullPath);
                }
            }
        }
    } catch {
        // Ignore cleanup errors
    }
}
