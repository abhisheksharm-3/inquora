/**
 * Application-wide constants.
 */

import type { TypeRetrievalConfiguration } from "@/types/rag";

/** File processing constants */
export const FILE_CONSTANTS = {
    MAX_FILE_SIZE_MB: 50,
    MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    ALLOWED_DOCUMENT_TYPES: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    STORAGE_BUCKET: "file-storage",
} as const;

/** Chat and message constants */
export const CHAT_CONSTANTS = {
    MAX_MESSAGE_LENGTH: 10000,
    DEFAULT_CONTEXT_WINDOW: 4096,
    MESSAGES_PER_PAGE: 50,
    TYPING_DEBOUNCE_MS: 300,
} as const;

/** Rate limiting constants */
export const RATE_LIMIT_CONSTANTS = {
    AUTH_REQUESTS_PER_MINUTE: 10,
    API_REQUESTS_PER_MINUTE: 60,
    FILE_UPLOADS_PER_HOUR: 20,
} as const;

/** Timing constants */
export const TIMING_CONSTANTS = {
    TOAST_DURATION_MS: 5000,
    DEBOUNCE_DELAY_MS: 300,
    STALE_TIME_MS: 30 * 1000,
    CACHE_TIME_MS: 5 * 60 * 1000,
    SESSION_REFRESH_INTERVAL_MS: 10 * 60 * 1000,
} as const;

/** Query keys for React Query */
export const QUERY_KEYS = {
    CHATS: ["chats"],
    MESSAGES: ["messages"],
    FILES: ["files"],
    USER: ["user"],
    MEMORIES: ["memories"],
} as const;

/** External service URLs */
export const EXTERNAL_URLS = {
    GITHUB_API: "https://api.github.com",
    YOUTUBE_WATCH: "https://www.youtube.com/watch",
} as const;

/** Document processing constants */
export const DOCUMENT_PROCESSING = {
    CHUNK_SIZE: 1000,
    CHUNK_OVERLAP: 200,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    BATCH_SIZE: 5,
    BATCH_DELAY_MS: 5000,
} as const;

/** YouTube download constants */
export const YOUTUBE_DOWNLOAD = {
    TIMEOUT_MS: 180000,
    MAX_AUDIO_SIZE_BYTES: 100 * 1024 * 1024,
} as const;

/** RAG retrieval default configuration */
export const DEFAULT_RETRIEVAL_CONFIG: TypeRetrievalConfiguration = {
    strategies: [
        { name: "semantic", weight: 0.6, topK: 8, enabled: true },
        { name: "keyword", weight: 0.3, topK: 5, enabled: true },
        { name: "contextual", weight: 0.1, topK: 3, enabled: true },
        { name: "stepback", weight: 0.15, topK: 4, enabled: true },
    ],
    rerankingEnabled: true,
    diversityThreshold: Number(process.env.RAG_DIVERSITY_THRESHOLD) || 0.7,
    minimumRelevanceScore: Number(process.env.RAG_MIN_RELEVANCE) || 0.3,
    maxResults: Number(process.env.RAG_MAX_RESULTS) || 10,
};

