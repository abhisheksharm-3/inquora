/**
 * Environment configuration with Zod validation.
 * This module validates all required environment variables at startup
 * and provides type-safe access to configuration values.
 */

import { z } from "zod";

const envSchema = z.object({
    // Supabase configuration
    NEXT_PUBLIC_SUPABASE_URL: z.string().url({
        message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
    }),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
        message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
    }),

    // Gemini AI configuration
    GEMINI_API_KEY: z.string().min(1).optional(),

    // Pinecone configuration
    PINECONE_API_KEY: z.string().min(1).optional(),
    PINECONE_INDEX_NAME: z.string().min(1).optional(),
    PINECONE_LEGACY_INDEX_NAMES: z.string().optional(),

    // Multiutility API (custom subtitle/embedding server)
    MULTIUTILITY_API_URL: z.string().url().optional(),
    MULTIUTILITY_API_KEY: z.string().min(1).optional(),

    // Site configuration
    SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    VERCEL_URL: z.string().optional(),

    // Node environment
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),

    // RAG Configuration
    RAG_CACHE_TTL: z.string().optional(),
    RAG_CACHE_SIZE: z.string().optional(),
});

type EnvType = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed configuration.
 * Throws a descriptive error if validation fails.
 */
function validateEnv(): EnvType {
    // Explicitly access process.env for client-side compatibility
    // Next.js replaces these with string literals at build time only when explicitly accessed
    const processEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        PINECONE_API_KEY: process.env.PINECONE_API_KEY,
        PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME,
        PINECONE_LEGACY_INDEX_NAMES: process.env.PINECONE_LEGACY_INDEX_NAMES,
        MULTIUTILITY_API_URL: process.env.MULTIUTILITY_API_URL,
        MULTIUTILITY_API_KEY: process.env.MULTIUTILITY_API_KEY,
        SITE_URL: process.env.SITE_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV,
        RAG_CACHE_TTL: process.env.RAG_CACHE_TTL,
        RAG_CACHE_SIZE: process.env.RAG_CACHE_SIZE,
    };

    const result = envSchema.safeParse(processEnv);

    if (!result.success) {
        const errors = result.error.issues
            .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
            .join("\n");

        throw new Error(
            `Environment validation failed:\n${errors}\n\nPlease check your .env file.`
        );
    }

    return result.data;
}

/**
 * Validated environment configuration.
 * Access this instead of process.env directly for type safety.
 */
export const env = validateEnv();

/**
 * Checks if Supabase is properly configured.
 */
export function isSupabaseConfigured(): boolean {
    return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Checks if Gemini AI is properly configured.
 */
export function isGeminiConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY);
}

/**
 * Checks if Pinecone is properly configured.
 */
export function isPineconeConfigured(): boolean {
    return Boolean(env.PINECONE_API_KEY && env.PINECONE_INDEX_NAME);
}

/**
 * Gets the site URL based on environment.
 */
export function getSiteUrl(): string {
    if (env.NODE_ENV === "development") {
        return "http://localhost:3000";
    }

    if (env.SITE_URL) {
        return env.SITE_URL;
    }

    if (env.VERCEL_URL) {
        return `https://${env.VERCEL_URL}`;
    }

    if (env.NEXT_PUBLIC_SITE_URL) {
        return env.NEXT_PUBLIC_SITE_URL;
    }

    return "https://inquora.vercel.app";
}

/**
 * Gets all configured Pinecone index names (current + legacy).
 */
export function getAllPineconeIndexNames(): string[] {
    const currentIndex = env.PINECONE_INDEX_NAME;
    const legacyIndexes =
        env.PINECONE_LEGACY_INDEX_NAMES?.split(",").map((name) => name.trim()) ||
        [];

    const allIndexes = currentIndex
        ? [currentIndex, ...legacyIndexes]
        : legacyIndexes;
    return [...new Set(allIndexes)];
}
