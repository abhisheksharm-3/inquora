"use server";

import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";

/**
 * Queries a Pinecone index for documents similar to a given query string.
 *
 * @param query The text to search for.
 * @param namespace The Pinecone namespace to query within.
 * @param topK The number of top results to return. Defaults to 5.
 * @returns A promise that resolves to an array of matching documents.
 * @throws An error if services are not configured or if the query fails.
 */
export const queryDocuments = async (
  query: string,
  namespace: string,
  topK: number = 5,
): Promise<Document[]> => {
  console.log(`Querying top ${topK} documents in namespace "${namespace}"...`);

  if (!(await isPineconeConfigured())) {
    throw new Error(
      "Pinecone is not configured. Please check environment variables.",
    );
  }

  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    throw new Error("Pinecone index could not be initialized.");
  }

  try {
    const embeddings = await createGeminiEmbeddings();
    if (!embeddings) {
      throw new Error("Failed to create Gemini embeddings.");
    }

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace,
    });

    const results = await vectorStore.similaritySearch(query, topK);
    console.log(`Found ${results.length} documents.`);
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error querying documents:", errorMessage);
    throw new Error(`Failed to query documents: ${errorMessage}`);
  }
};

/**
 * Checks if a namespace exists and contains records in the Pinecone index.
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

  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    console.warn(
      "Pinecone index not initialized, assuming namespace does not exist.",
    );
    return false;
  }

  try {
    console.log(`Checking for namespace "${namespace}" in Pinecone...`);
    const stats = await pineconeIndex.describeIndexStats();
    const namespaceStats = stats.namespaces?.[namespace];

    const exists = (namespaceStats?.recordCount ?? 0) > 0;
    console.log(`Namespace "${namespace}" exists: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`Error checking if namespace "${namespace}" exists:`, error);
    return false; // Assume it doesn't exist on error
  }
};
