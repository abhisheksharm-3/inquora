/**
 * Shared utilities for GitHub processors.
 * Provides common constants, types, and functions used by the GitHub processor.
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex } from "../pinecone";
import { Document } from "@langchain/core/documents";
import { TypeGitHubParseResult } from "@/types/github";

/** Document processing constants */
export const GITHUB_CHUNK_SIZE = 1000;
export const GITHUB_CHUNK_OVERLAP = 200;
export const GITHUB_MAX_RETRIES = 3;
export const GITHUB_RETRY_DELAY_MS = 1000;
export const GITHUB_MAX_FILE_SIZE = 1024 * 1024; // 1MB limit per file

/** File extensions to include in processing */
export const PROCESSABLE_EXTENSIONS = new Set([
    ".md", ".txt", ".js", ".ts", ".jsx", ".tsx",
    ".py", ".java", ".cpp", ".c", ".h", ".cs",
    ".php", ".rb", ".go", ".rs", ".kt", ".swift",
    ".sql", ".json", ".yaml", ".yml", ".xml",
    ".html", ".css", ".scss", ".less", ".env",
    ".sh", ".bash", ".zsh", ".ps1", ".dockerfile",
    ".makefile", ".toml", ".ini", ".cfg", ".conf",
    ".rst", ".graphql", ".prisma", ".vue", ".svelte",
]);

/** Directories to skip during repository traversal */
export const SKIPPED_DIRECTORIES = new Set([
    "node_modules", ".git", "dist", "build", "out",
    ".next", "coverage", ".nyc_output", "vendor",
    "target", ".vscode", ".idea", "__pycache__",
    ".pytest_cache", ".cache", "tmp", "temp",
    ".DS_Store", "logs", "*.log", ".env.local",
    ".env.production",
]);

/**
 * Parses a GitHub URL to extract owner and repository name.
 */
export function parseGitHubUrl(url: string): TypeGitHubParseResult | null {
    const patterns = [
        /github\.com\/([^/]+)\/([^/\s?#]+)/i,
        /github\.com:([^/]+)\/([^/\s?#]+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace(/\.git$/, ""),
            };
        }
    }

    return null;
}

/**
 * Splits documents into chunks for vector storage.
 */
export async function splitDocuments(documents: Document[]): Promise<Document[]> {
    if (!documents || documents.length === 0) {
        return [];
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: GITHUB_CHUNK_SIZE,
        chunkOverlap: GITHUB_CHUNK_OVERLAP,
    });

    const chunkedDocs = await splitter.splitDocuments(documents);

    return chunkedDocs.filter((doc) => {
        const content = doc.pageContent?.trim();
        return content && content.length > 0;
    });
}

/**
 * Creates embeddings and stores document chunks in Pinecone.
 */
export async function storeDocsInPinecone(
    docs: Document[],
    namespace: string
): Promise<void> {
    const validDocs = docs.filter((doc) => {
        const content = doc.pageContent?.trim();
        return content && content.length > 0;
    });

    if (validDocs.length === 0) {
        throw new Error("No valid documents to store after filtering empty content");
    }

    const embeddings = await createEmbeddings();
    if (!embeddings) {
        throw new Error("Failed to create embeddings. Gemini API may not be configured.");
    }

    const pineconeIndex = await getPineconeIndex();
    if (!pineconeIndex) {
        throw new Error("Pinecone index is not initialized.");
    }

    let retries = 0;
    while (retries < GITHUB_MAX_RETRIES) {
        try {
            const batchSize = 5;
            for (let i = 0; i < validDocs.length; i += batchSize) {
                const batch = validDocs.slice(i, i + batchSize);

                await PineconeStore.fromDocuments(batch, embeddings, {
                    pineconeIndex,
                    namespace,
                });

                if (i + batchSize < validDocs.length) {
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
            return;
        } catch (error) {
            retries++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (retries >= GITHUB_MAX_RETRIES) {
                if (errorMessage.includes("Vector dimension 0")) {
                    throw new Error(
                        `Failed to process repository due to API rate limits. Large repositories require upgraded API quotas.`
                    );
                }
                throw error;
            }

            await new Promise((resolve) =>
                setTimeout(resolve, GITHUB_RETRY_DELAY_MS * retries * 5)
            );
        }
    }
}

/**
 * Maps file extensions to programming languages.
 */
export function getLanguageFromExtension(ext: string): string | null {
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
        ".md": "Markdown",
        ".html": "HTML",
        ".css": "CSS",
        ".scss": "SCSS",
        ".vue": "Vue",
        ".svelte": "Svelte",
    };

    return languageMap[ext.toLowerCase()] || null;
}
