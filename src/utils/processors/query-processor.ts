"use server";

import type { Index } from "@pinecone-database/pinecone";
import { createEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured, findIndexForNamespace } from "../pinecone";
import { Document } from "@langchain/core/documents";
import { pineconeRateLimiter } from "../rag/rate-limiter";

/**
 * Queries Pinecone for documents similar to a given query string.
 * Automatically searches current index and falls back to legacy indexes if namespace not found.
 * Returns documents with their similarity scores.
 *
 * @param query The text to search for.
 * @param namespace The Pinecone namespace to query within.
 * @param topK The number of top results to return. Defaults to 5.
 * @param pineconeIndex Optional pre-resolved index.
 * @returns A promise that resolves to an array of [Document, score] tuples.
 */
export const queryDocuments = async (
  query: string,
  namespace: string,
  topK: number = 5,
  pineconeIndex?: Index
): Promise<[Document, number][]> => {
  console.log(`Querying top ${topK} documents in namespace "${namespace}"...`);

  if (!(await isPineconeConfigured())) {
    throw new Error(
      "Pinecone is not configured. Please check environment variables.",
    );
  }

  try {
    const embeddings = await createEmbeddings();
    if (!embeddings) {
      throw new Error("Failed to create embeddings.");
    }

    let targetIndex = pineconeIndex;

    // If index not provided, find it
    if (!targetIndex) {
      // First, try to find which index contains this namespace
      const indexInfo = await findIndexForNamespace(namespace);

      if (indexInfo) {
        // Found the namespace in a specific index
        console.log(`Using index ${indexInfo.indexName} for namespace "${namespace}"`);
        targetIndex = indexInfo.index;
      } else {
        // Namespace not found in any index, use current index (for new writes)
        console.log(`Namespace "${namespace}" not found in any index, using current index for new data`);
        targetIndex = await getPineconeIndex();
      }
    } else {
      console.log(`Using provided Pinecone index for namespace "${namespace}"`);
    }

    if (!targetIndex) {
      throw new Error("Pinecone index could not be initialized.");
    }

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: targetIndex,
      namespace,
    });

    const results = await pineconeRateLimiter.execute(() => vectorStore.similaritySearchWithScore(query, topK));
    console.log(`Found ${results.length} documents in namespace "${namespace}".`);
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error querying documents:", errorMessage);
    throw new Error(`Failed to query documents: ${errorMessage}`);
  }
};

/**
 * Checks if a namespace exists and contains records in any configured Pinecone index.
 * Searches current index first, then legacy indexes.
 *
 * @param namespace The namespace to check.
 * @returns A promise that resolves to `true` if the namespace exists and has > 0 vectors, otherwise `false`.
 */
export const checkNamespaceExists = async (
  namespace: string,
): Promise<boolean> => {
  if (!(await isPineconeConfigured())) {
    console.warn("Pinecone not configured, assuming namespace does not exist.");
    return false;
  }

  try {
    console.log(`Checking for namespace "${namespace}" across all Pinecone indexes...`);
    const indexInfo = await findIndexForNamespace(namespace);

    if (indexInfo) {
      console.log(`Namespace "${namespace}" exists in index: ${indexInfo.indexName}`);
      return true;
    }

    console.log(`Namespace "${namespace}" does not exist in any configured index`);
    return false;
  } catch (error) {
    console.error(`Error checking if namespace "${namespace}" exists:`, error);
    return false;
  }
};
