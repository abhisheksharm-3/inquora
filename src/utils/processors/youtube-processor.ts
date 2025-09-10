"use server";

import { YoutubeTranscript } from "youtube-transcript";
import { YoutubeTranscript as DanielYoutubeTranscript } from "@danielxceron/youtube-transcript";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";
import { extractYoutubeVideoId } from "../youtube-utils";
import { supabaseBrowserClient } from "../supabase/client";
import { updateFileStatus } from "../file-processing-utils";

// --- Constants ---
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Fetches and formats the transcript from a YouTube video with multiple fallback methods.
 * @private
 */
const _fetchAndFormatTranscript = async (videoId: string): Promise<string> => {
  console.log(`Fetching transcript for YouTube video: ${videoId}`);
  
  // Method 1: Try danielxceron/youtube-transcript (primary)
  try {
    console.log("Attempting with @danielxceron/youtube-transcript...");
    const transcriptParts = await DanielYoutubeTranscript.fetchTranscript(videoId);
    
    if (transcriptParts && transcriptParts.length > 0) {
      const transcriptText = transcriptParts.map((item) => item.text).join(" ");
      console.log(`Successfully extracted transcript with ${transcriptText.length} characters using danielxceron.`);
      return transcriptText;
    }
  } catch (error) {
    console.warn("danielxceron/youtube-transcript failed:", error);
  }

  // Method 2: Try original youtube-transcript (fallback 1)
  try {
    console.log("Attempting with original youtube-transcript...");
    const transcriptParts = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (transcriptParts && transcriptParts.length > 0) {
      const transcriptText = transcriptParts.map((item) => item.text).join(" ");
      console.log(`Successfully extracted transcript with ${transcriptText.length} characters using original.`);
      return transcriptText;
    }
  } catch (error) {
    console.warn("Original youtube-transcript failed:", error);
  }

  // Method 3: Try alternative API approach (fallback 2)
  try {
    console.log("Attempting alternative YouTube API approach...");
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    // Extract captions from video page - this is a basic approach
    const captionMatch = html.match(/"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":\[([^\]]+)\]/);
    if (captionMatch) {
      const captionData = JSON.parse(`[${captionMatch[1]}]`) as Array<{
        languageCode: string;
        baseUrl?: string;
      }>;
      const englishCaption = captionData.find((cap) => 
        cap.languageCode === 'en' || cap.languageCode === 'en-US' || cap.languageCode.startsWith('en')
      );
      
      if (englishCaption && englishCaption.baseUrl) {
        const captionResponse = await fetch(englishCaption.baseUrl);
        const captionXml = await captionResponse.text();
        
        // Parse XML captions
        const textMatches = captionXml.match(/<text[^>]*>([^<]+)<\/text>/g);
        if (textMatches) {
          const transcriptText = textMatches
            .map(match => match.replace(/<[^>]*>/g, '').trim())
            .filter(text => text.length > 0)
            .join(' ');
          
          if (transcriptText.length > 0) {
            console.log(`Successfully extracted transcript with ${transcriptText.length} characters using alternative method.`);
            return transcriptText;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Alternative YouTube API approach failed:", error);
  }

  throw new Error("No transcript content found using any available method. The video may not have captions available.");
};

/**
 * Splits the transcript text into chunked documents.
 * @private
 */
const _splitTranscriptToDocs = async (
  transcript: string,
  videoUrl: string
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
  console.log(`Transcript split into ${chunkedDocs.length} chunks.`);
  return chunkedDocs;
};

/**
 * Creates embeddings and stores the document chunks in Pinecone.
 * @private
 */
const _storeDocsInPinecone = async (
  docs: Document[],
  namespace: string,
) => {
  console.log("Creating Gemini embeddings...");
  const embeddings = await createGeminiEmbeddings();
  if (!embeddings) {
    throw new Error("Failed to create embeddings. Gemini API may not be configured properly.");
  }

  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    throw new Error("Pinecone index is not initialized.");
  }

  console.log(`Storing ${docs.length} chunks in Pinecone with namespace: ${namespace}...`);
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      await PineconeStore.fromDocuments(docs, embeddings, {
        pineconeIndex,
        namespace,
      });
      console.log("Successfully stored transcript chunks in Pinecone.");
      return; // Success
    } catch (error) {
      retries++;
      console.error(`Error storing in Pinecone (attempt ${retries}/${MAX_RETRIES}):`, error);
      if (retries >= MAX_RETRIES) {
        throw error; // Re-throw after final attempt
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
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

    const transcriptText = await _fetchAndFormatTranscript(videoId);
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

    await updateFileStatus(supabase, namespace, "failed", { error: errorMessage });

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
  videoId: string
): Promise<{ title: string; channel: string; duration: number }> => {
  return {
    title: `YouTube Video ${videoId}`,
    channel: "Unknown Channel",
    duration: 0, // Duration in seconds
  };
};