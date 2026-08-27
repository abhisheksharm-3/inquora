"use server";

import { YoutubeTranscript } from "youtube-transcript";
import { YoutubeTranscript as DanielYoutubeTranscript } from "@danielxceron/youtube-transcript";
import { fetchTranscript } from "youtube-transcript-plus";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createEmbeddings } from "../gemini/embeddings";
import { extractYoutubeSubtitles, transcribeAudio } from "../multiutility-api";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "@langchain/core/documents";
import { extractYoutubeVideoId } from "../youtube-utils";
import { supabaseBrowserClient } from "@/data/supabase/client";
import { updateFileStatus } from "../file-processing-utils";
import { downloadYoutubeAudio } from "../youtube/audio-downloader";
import { getYoutubeTranscript } from "../youtube/transcript";

// --- Constants ---
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Fetches and formats the transcript from a YouTube video with multiple fallback methods.
 * @private
 */
const _fetchAndFormatTranscript = async (videoId: string, videoUrl: string): Promise<string> => {
  console.log(`Fetching transcript for YouTube video: ${videoId}`);

  // Method 1: Download and Transcribe (Primary) - Using pure JS libraries
  // This downloads the audio and sends it to the custom transcription API.
  try {
    console.log("Attempting download and transcribe (Primary method)...");

    const { buffer, mimeType } = await downloadYoutubeAudio(videoId, videoUrl);

    // Determine file extension from mime type
    const extension = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("mp3")
          ? "mp3"
          : "audio";

    console.log(
      `Audio downloaded (${buffer.length} bytes, ${mimeType}). Sending to transcription service...`,
    );

    const transcriptText = await transcribeAudio(buffer, `${videoId}.${extension}`, "en");

    if (transcriptText && transcriptText.length > 0) {
      console.log(`Successfully transcribed video with ${transcriptText.length} characters.`);
      return transcriptText;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Download/Transcribe failed:", message);
    console.log("Falling back to subtitle extraction methods...");
  }

  // Method 2: Try youtubei.js native transcript extraction
  try {
    const transcript = await getYoutubeTranscript(videoId);
    if (transcript && transcript.length > 0) {
      console.log(
        `Successfully extracted transcript with ${transcript.length} characters using youtubei.js.`,
      );
      return transcript;
    }
  } catch (error) {
    console.warn("youtubei.js transcript extraction failed:", error);
  }

  // Method 3: Try custom subtitle extraction API
  try {
    console.log("Attempting with custom subtitle API...");
    const result = await extractYoutubeSubtitles(videoUrl);

    if (result.subtitles && result.subtitles.length > 0) {
      const transcriptText = result.subtitles.join(" ");
      console.log(
        `Successfully extracted transcript with ${transcriptText.length} characters using custom API.`,
      );
      return transcriptText;
    }
  } catch (error) {
    console.warn("Custom subtitle API failed:", error);
  }

  // Method 4: Try youtube-transcript-plus
  try {
    console.log("Attempting with youtube-transcript-plus...");
    const transcriptParts = await fetchTranscript(videoId);

    if (transcriptParts && transcriptParts.length > 0) {
      const transcriptText = transcriptParts.map((item) => item.text).join(" ");
      console.log(
        `Successfully extracted transcript with ${transcriptText.length} characters using youtube-transcript-plus.`,
      );
      return transcriptText;
    }
  } catch (error) {
    console.warn("youtube-transcript-plus failed:", error);
  }

  // Method 5: Try @danielxceron/youtube-transcript
  try {
    console.log("Attempting with @danielxceron/youtube-transcript...");
    const transcriptParts = await DanielYoutubeTranscript.fetchTranscript(videoId);

    if (transcriptParts && transcriptParts.length > 0) {
      const transcriptText = transcriptParts.map((item) => item.text).join(" ");
      console.log(
        `Successfully extracted transcript with ${transcriptText.length} characters using danielxceron.`,
      );
      return transcriptText;
    }
  } catch (error) {
    console.warn("danielxceron/youtube-transcript failed:", error);
  }

  // Method 6: Try original youtube-transcript
  try {
    console.log("Attempting with original youtube-transcript...");
    const transcriptParts = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcriptParts && transcriptParts.length > 0) {
      const transcriptText = transcriptParts.map((item) => item.text).join(" ");
      console.log(
        `Successfully extracted transcript with ${transcriptText.length} characters using original.`,
      );
      return transcriptText;
    }
  } catch (error) {
    console.warn("Original youtube-transcript failed:", error);
  }

  // Method 7: Try alternative API approach
  try {
    console.log("Attempting alternative YouTube API approach...");
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();

    // Extract captions from video page - this is a basic approach
    const captionMatch = html.match(
      /"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":\[([^\]]+)\]/,
    );
    if (captionMatch) {
      const captionData = JSON.parse(`[${captionMatch[1]}]`) as Array<{
        languageCode: string;
        baseUrl?: string;
      }>;
      const englishCaption = captionData.find(
        (cap) =>
          cap.languageCode === "en" ||
          cap.languageCode === "en-US" ||
          cap.languageCode.startsWith("en"),
      );

      if (englishCaption && englishCaption.baseUrl) {
        const captionResponse = await fetch(englishCaption.baseUrl);
        const captionXml = await captionResponse.text();

        // Parse XML captions
        const textMatches = captionXml.match(/<text[^>]*>([^<]+)<\/text>/g);
        if (textMatches) {
          const transcriptText = textMatches
            .map((match) => match.replace(/<[^>]*>/g, "").trim())
            .filter((text) => text.length > 0)
            .join(" ");

          if (transcriptText.length > 0) {
            console.log(
              `Successfully extracted transcript with ${transcriptText.length} characters using alternative method.`,
            );
            return transcriptText;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Alternative YouTube API approach failed:", error);
  }

  throw new Error(
    "No transcript content found using any available method. The video may not have captions available.",
  );
};

/**
 * Splits the transcript text into chunked documents.
 * @private
 */
const _splitTranscriptToDocs = async (
  transcript: string,
  videoUrl: string,
): Promise<Document[]> => {
  console.log(`Splitting transcript into chunks...`);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const doc = new Document({
    pageContent: transcript,
    metadata: { source: videoUrl, type: "youtube" },
  });
  const chunkedDocs = await splitter.splitDocuments([doc]);

  // Filter out empty or whitespace-only chunks
  const validChunks = chunkedDocs.filter((doc) => {
    const content = doc.pageContent?.trim();
    return content && content.length > 0;
  });

  const filteredCount = chunkedDocs.length - validChunks.length;
  if (filteredCount > 0) {
    console.log(`Filtered out ${filteredCount} empty chunks`);
  }

  console.log(`Transcript split into ${validChunks.length} valid chunks.`);
  return validChunks;
};

/**
 * Creates embeddings and stores the document chunks in Pinecone.
 * @private
 */
const _storeDocsInPinecone = async (docs: Document[], namespace: string) => {
  // Final validation: ensure all documents have non-empty content
  const validDocs = docs.filter((doc) => {
    const content = doc.pageContent?.trim();
    const isValid = content && content.length > 0;
    if (!isValid) {
      console.warn("Filtering out document with empty content:", doc.metadata);
    }
    return isValid;
  });

  if (validDocs.length === 0) {
    throw new Error("No valid documents to store after filtering empty content");
  }

  if (validDocs.length < docs.length) {
    console.log(`Filtered ${docs.length - validDocs.length} documents with empty content`);
  }

  console.log("Creating embeddings...");
  const embeddings = await createEmbeddings();
  if (!embeddings) {
    throw new Error("Failed to create embeddings. Gemini API may not be configured properly.");
  }

  // Test embeddings with a simple string to ensure they work
  console.log("Testing embeddings generation...");
  try {
    const testEmbedding = await embeddings.embedQuery("test");
    if (!testEmbedding || testEmbedding.length === 0) {
      throw new Error("Embeddings test failed: returned empty vector");
    }
    console.log(`Embeddings test successful. Vector dimension: ${testEmbedding.length}`);
  } catch (error) {
    console.error("Embeddings test failed:", error);
    throw new Error(
      `Failed to generate embeddings. This could be due to:
      1. Invalid or missing GEMINI_API_KEY
      2. Gemini API rate limiting or quota exceeded
      3. Network connectivity issues
      Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    throw new Error("Pinecone index is not initialized.");
  }

  console.log(`Storing ${validDocs.length} chunks in Pinecone with namespace: ${namespace}...`);
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      // Process in batches to avoid rate limits
      // Using 5 docs per batch with 5 second delay = ~12 requests/minute (under 15 RPM limit)
      const batchSize = 5;
      for (let i = 0; i < validDocs.length; i += batchSize) {
        const batch = validDocs.slice(i, i + batchSize);
        console.log(
          `Storing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validDocs.length / batchSize)}...`,
        );

        // Log first document in batch for debugging
        if (i === 0 && batch.length > 0) {
          console.log(`First document preview: ${batch[0].pageContent.substring(0, 100)}...`);
        }

        await PineconeStore.fromDocuments(batch, embeddings, {
          pineconeIndex,
          namespace,
        });

        // 5 second delay between batches to stay under API rate limits
        // This keeps us at ~12 embeddings/minute, well under Gemini's 15 RPM free tier limit
        if (i + batchSize < validDocs.length) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      console.log("Successfully stored transcript chunks in Pinecone.");
      return; // Success
    } catch (error) {
      retries++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error storing in Pinecone (attempt ${retries}/${MAX_RETRIES}):`, error);

      // Check if this is a rate limit error
      if (errorMessage.includes("Vector dimension 0") || errorMessage.includes("rate limit")) {
        console.warn(
          "⚠️ Rate limit detected. This typically happens with large content on free API tiers.",
        );
        console.warn(
          "💡 Solutions: 1) Use shorter videos, 2) Upgrade Gemini API quota, 3) Wait and retry",
        );
      }

      if (retries >= MAX_RETRIES) {
        if (errorMessage.includes("Vector dimension 0")) {
          throw new Error(
            `Failed to process video due to API rate limits. Large transcripts (${validDocs.length} chunks) require upgraded API quotas. Please try a shorter video or upgrade your Gemini API tier.`,
          );
        }
        throw error; // Re-throw after final attempt
      }

      // Longer delay on retry to let rate limits reset
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * retries * 5));
    }
  }
};

/**
 * Processes a YouTube video by fetching its transcript, creating embeddings,
 * and storing them in a Pinecone vector store.
 *
 * @param videoUrl The URL of the YouTube video.
 * @param namespace The unique ID (and Pinecone namespace) for the file.
 * @returns A promise that resolves with the outcome of the processing.
 */
export const processYoutubeVideo = async (
  videoUrl: string,
  namespace: string,
): Promise<{ numDocs: number; success: boolean; error?: string }> => {
  console.log(`Starting YouTube transcript processing for namespace: ${namespace}`);
  if (!(await isPineconeConfigured())) {
    throw new Error("Pinecone is not configured. Please check environment variables.");
  }

  const supabase = supabaseBrowserClient();
  const videoId = extractYoutubeVideoId(videoUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL. Could not extract video ID.");
  }

  try {
    await updateFileStatus(supabase, namespace, "processing");

    const transcriptText = await _fetchAndFormatTranscript(videoId, videoUrl);
    const chunkedDocs = await _splitTranscriptToDocs(transcriptText, videoUrl);
    await _storeDocsInPinecone(chunkedDocs, namespace);

    await updateFileStatus(supabase, namespace, "completed", {
      indexedChunks: chunkedDocs.length,
      fullText: transcriptText,
    });

    return { numDocs: chunkedDocs.length, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Processing failed for namespace ${namespace}:`, errorMessage);

    await updateFileStatus(supabase, namespace, "failed", {
      error: errorMessage,
    });

    // Return a failure result instead of throwing to allow for graceful handling.
    return { numDocs: 0, success: false, error: errorMessage };
  }
};

/**
 * Retrieves basic information about a YouTube video.
 * Note: This is a placeholder. A real implementation would use the YouTube Data API.
 *
 * @param videoId The unique ID of the YouTube video.
 * @returns A promise that resolves to the video's information.
 */
export const getYoutubeVideoInfo = async (
  videoId: string,
): Promise<{ title: string; channel: string; duration: number }> => {
  return {
    title: `YouTube Video ${videoId}`,
    channel: "Unknown Channel",
    duration: 0, // Duration in seconds
  };
};
