/**
 * Gemini AI configuration constants.
 * Centralized settings for the Gemini client to avoid duplication.
 */

import { HarmCategory, HarmBlockThreshold, GenerationConfig } from "@google/generative-ai";

/** Default generation configuration for Gemini models */
export const GEMINI_GENERATION_CONFIG: GenerationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
};

/** Safety settings that allow all content */
export const GEMINI_SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
] as const;

/** Model name for Gemini */
export const GEMINI_MODEL_NAME = "gemini-3.1-flash-lite-preview";
