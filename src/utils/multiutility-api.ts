"use server";

import { env } from "@/config/env";

// --- Types ---

interface SubtitleExtractRequest {
  url: string;
  lang?: string;
}

interface SubtitleExtractResponse {
  language: string;
  video_id: string;
  subtitles: string[];
}

interface EmbeddingRequest {
  texts: string[];
  normalize?: boolean;
}

interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

interface AudioTranscribeResponse {
  language: string;
  transcription: string;
  file_name: string;
}

interface HealthResponse {
  status: string;
  service: string;
  model?: string;
}

// --- Constants ---

const DEFAULT_API_URL = "https://abhisheksan-multiutility-server.hf.space";
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds for large requests

/**
 * Gets the configured API URL from environment or uses default.
 */
const getApiUrl = (): string => {
  return env.MULTIUTILITY_API_URL || DEFAULT_API_URL;
};

/**
 * Gets the API key for authentication.
 */
const getApiKey = (): string => {
  const apiKey = env.MULTIUTILITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MULTIUTILITY_API_KEY is required. Please set it in your environment variables.",
    );
  }
  return apiKey;
};

/**
 * Makes a POST request to the multiutility API.
 */
const apiPost = async <TRequest, TResponse>(
  endpoint: string,
  body: TRequest,
): Promise<TResponse> => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  const apiKey = getApiKey();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return (await response.json()) as TResponse;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Makes a GET request to the multiutility API.
 */
const apiGet = async <TResponse>(endpoint: string): Promise<TResponse> => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  const apiKey = getApiKey();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return (await response.json()) as TResponse;
  } finally {
    clearTimeout(timeoutId);
  }
};

// --- Subtitles API ---

/**
 * Extracts subtitles from a YouTube video URL.
 *
 * @param url - The YouTube video URL
 * @param lang - Optional language code (default: "en")
 * @returns Subtitle extraction response with video_id and subtitle lines
 */
export const extractYoutubeSubtitles = async (
  url: string,
  lang: string = "en",
): Promise<SubtitleExtractResponse> => {
  console.log(`Extracting subtitles via custom API for URL: ${url}`);

  const response = await apiPost<SubtitleExtractRequest, SubtitleExtractResponse>(
    "/api/v1/subtitles/extract",
    { url, lang },
  );

  console.log(
    `Successfully extracted ${response.subtitles.length} subtitle lines for video: ${response.video_id}`,
  );

  return response;
};

/**
 * Health check for the subtitles service.
 */
export const checkSubtitlesHealth = async (): Promise<HealthResponse> => {
  return apiGet<HealthResponse>("/api/v1/subtitles/health");
};

// --- Embeddings API ---

/**
 * Generates embeddings for a list of texts using the custom embedding model.
 * Returns 1024-dimensional vectors.
 *
 * @param texts - Array of texts to embed
 * @param normalize - Whether to normalize vectors (default: true)
 * @returns Embedding response with vectors and model info
 */
export const generateEmbeddings = async (
  texts: string[],
  normalize: boolean = true,
): Promise<EmbeddingResponse> => {
  if (texts.length === 0) {
    return {
      embeddings: [],
      model: "custom-embedding",
      dimensions: 1024,
    };
  }

  // Filter out empty texts
  const validTexts = texts.filter((text) => text && text.trim().length > 0);

  if (validTexts.length === 0) {
    throw new Error("No valid texts provided for embedding generation");
  }

  console.log(`Generating embeddings for ${validTexts.length} texts...`);

  const response = await apiPost<EmbeddingRequest, EmbeddingResponse>(
    "/api/v1/embeddings/generate",
    { texts: validTexts, normalize },
  );

  console.log(
    `Generated ${response.embeddings.length} embeddings with dimension ${response.dimensions} using model: ${response.model}`,
  );

  return response;
};

/**
 * Health check for the embeddings service.
 */
export const checkEmbeddingsHealth = async (): Promise<HealthResponse> => {
  return apiGet<HealthResponse>("/api/v1/embeddings/health");
};

// --- Transcription API ---

/**
 * Transcribes an audio file using the custom API.
 *
 * @param audioBuffer - The audio file buffer
 * @param fileName - Original filename
 * @param lang - Language code (default: "en")
 * @returns The transcribed text
 */
export const transcribeAudio = async (
  audioBuffer: Buffer,
  fileName: string,
  lang: string = "en",
): Promise<string> => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}/api/v1/subtitles/transcribe`;
  const apiKey = getApiKey();

  const formData = new FormData();
  // Create a Blob from the buffer since FormData expects Blob/File
  const blob = new Blob([audioBuffer as unknown as BlobPart], { type: "audio/mpeg" });
  formData.append("file", blob, fileName);
  formData.append("lang", lang);

  const controller = new AbortController();
  // Transcription can take longer, allow 5 minutes
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    console.log(`Uploading audio for transcription: ${fileName} (${audioBuffer.length} bytes)`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        // Do NOT set Content-Type for FormData, browser/node sets boundary automatically
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Transcription failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as AudioTranscribeResponse;
    console.log(`Transcription successful for ${fileName}`);
    return data.transcription;
  } finally {
    clearTimeout(timeoutId);
  }
};

// --- Utility Exports ---

export type {
  SubtitleExtractRequest,
  SubtitleExtractResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  HealthResponse,
};
