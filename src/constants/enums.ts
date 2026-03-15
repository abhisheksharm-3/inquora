/**
 * File processing status enum.
 * Centralizes the processing status values used throughout the application.
 */

export const EnumProcessingStatus = {
    IDLE: "idle",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;

export type TypeProcessingStatus = typeof EnumProcessingStatus[keyof typeof EnumProcessingStatus];

/**
 * Document type enum.
 * Represents the different types of content the application can process.
 */
export const EnumDocumentType = {
    PDF: "pdf",
    IMAGE: "image",
    DOC: "doc",
    VIDEO: "video",
    SHEET: "sheet",
    SLIDES: "slides",
    GITHUB: "github",
    WEB: "web",
} as const;

export type TypeDocumentType = typeof EnumDocumentType[keyof typeof EnumDocumentType];

/**
 * Message role enum.
 */
export const EnumMessageRole = {
    USER: "user",
    ASSISTANT: "assistant",
} as const;

export type TypeMessageRole = typeof EnumMessageRole[keyof typeof EnumMessageRole];
