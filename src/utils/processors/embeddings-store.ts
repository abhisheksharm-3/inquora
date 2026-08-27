"use server";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "@langchain/core/documents";
import { createEmbeddings } from "../gemini/embeddings";
import { getPineconeIndex } from "../pinecone";
import { DOCUMENT_PROCESSING } from "@/config/constants";

/**
 * Processes and stores document chunks in Pinecone with retry logic.
 * @param docs - Documents to process
 * @param namespace - Pinecone namespace for storage
 */
export async function processAndStoreDocuments(
  docs: Document[],
  namespace: string,
): Promise<{ numDocs: number }> {
  if (!docs || docs.length === 0) {
    throw new Error("No processable content found in the document.");
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: DOCUMENT_PROCESSING.CHUNK_SIZE,
    chunkOverlap: DOCUMENT_PROCESSING.CHUNK_OVERLAP,
  });
  const chunkedDocs = await textSplitter.splitDocuments(docs);

  const validChunks = chunkedDocs.filter((doc) => {
    const content = doc.pageContent?.trim();
    return content && content.length > 0;
  });

  if (validChunks.length === 0) {
    throw new Error("No valid chunks to store after filtering");
  }

  const embeddings = await createEmbeddings();
  if (!embeddings) {
    throw new Error("Failed to create embeddings. API may not be configured properly.");
  }

  const testEmbedding = await embeddings.embedQuery("test");
  if (!testEmbedding || testEmbedding.length === 0) {
    throw new Error("Embeddings test failed: returned empty vector");
  }

  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    throw new Error("Pinecone index is not initialized.");
  }

  let retries = 0;
  while (retries < DOCUMENT_PROCESSING.MAX_RETRIES) {
    try {
      for (let i = 0; i < validChunks.length; i += DOCUMENT_PROCESSING.BATCH_SIZE) {
        const batch = validChunks.slice(i, i + DOCUMENT_PROCESSING.BATCH_SIZE);

        await PineconeStore.fromDocuments(batch, embeddings, {
          pineconeIndex,
          namespace,
        });

        if (i + DOCUMENT_PROCESSING.BATCH_SIZE < validChunks.length) {
          await new Promise((resolve) => setTimeout(resolve, DOCUMENT_PROCESSING.BATCH_DELAY_MS));
        }
      }

      return { numDocs: validChunks.length };
    } catch (error) {
      retries++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (retries >= DOCUMENT_PROCESSING.MAX_RETRIES) {
        if (errorMessage.includes("Vector dimension 0")) {
          throw new Error(
            `Failed to process document due to API rate limits. Large documents (${validChunks.length} chunks) require upgraded API quotas.`,
          );
        }
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, DOCUMENT_PROCESSING.RETRY_DELAY_MS * retries * 5),
      );
    }
  }

  throw new Error("Failed to store documents in Pinecone after multiple retries.");
}
