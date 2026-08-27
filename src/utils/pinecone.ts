"use server";

import { Pinecone, Index } from "@pinecone-database/pinecone";
import {
  env,
  isPineconeConfigured as checkPineconeConfigured,
  getAllPineconeIndexNames as getIndexNames,
} from "@/config/env";
import { pineconeRateLimiter } from "./rag/rate-limiter";

let pineconeClientInstance: Pinecone | null = null;
const pineconeIndexCache: Map<string, Index> = new Map();

/**
 * Retrieves the singleton Pinecone client instance.
 * @returns A promise that resolves to the Pinecone client instance.
 * @throws If the PINECONE_API_KEY environment variable is not set.
 */
export const getPineconeClient = async (): Promise<Pinecone> => {
  if (pineconeClientInstance) {
    return pineconeClientInstance;
  }

  if (!env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY environment variable is not set.");
  }

  console.log("Initializing Pinecone client...");
  pineconeClientInstance = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  console.log("Pinecone client initialized successfully.");
  return pineconeClientInstance;
};

/**
 * Gets all configured Pinecone index names (current + legacy).
 */
export const getAllIndexNames = async (): Promise<string[]> => {
  return getIndexNames();
};

/**
 * Retrieves a Pinecone index instance by name (with caching).
 * @param indexName - Optional specific index name. Defaults to PINECONE_INDEX_NAME env var.
 * @returns A promise that resolves to the Pinecone index instance.
 */
export const getPineconeIndex = async (indexName?: string): Promise<Index> => {
  const targetIndexName = indexName || env.PINECONE_INDEX_NAME;

  if (!targetIndexName) {
    throw new Error(
      "PINECONE_INDEX_NAME environment variable is not set and no index name provided.",
    );
  }

  if (pineconeIndexCache.has(targetIndexName)) {
    return pineconeIndexCache.get(targetIndexName)!;
  }

  const client = await getPineconeClient();
  console.log(`Getting Pinecone index: ${targetIndexName}`);
  const index = client.Index(targetIndexName);

  pineconeIndexCache.set(targetIndexName, index);

  console.log(`Pinecone index ${targetIndexName} retrieved and cached successfully.`);
  return index;
};

/**
 * Checks if the necessary Pinecone environment variables are configured.
 */
export const isPineconeConfigured = async (): Promise<boolean> => {
  return checkPineconeConfigured();
};

/**
 * Attempts to find which index contains the given namespace.
 * Checks current index first, then falls back to legacy indexes.
 * @param {string} namespace - The namespace to search for
 * @returns {Promise<{indexName: string, index: Index} | null>} The index info if found, null otherwise
 */
export const findIndexForNamespace = async (
  namespace: string,
): Promise<{ indexName: string; index: Index } | null> => {
  const allIndexNames = await getAllIndexNames();

  if (allIndexNames.length === 0) {
    console.warn("No Pinecone indexes configured");
    return null;
  }

  // Create an array of checks to run in parallel
  const checks = allIndexNames.map(async (indexName) => {
    try {
      const index = await getPineconeIndex(indexName);
      const stats = await pineconeRateLimiter.execute(() => index.describeIndexStats());

      if (stats.namespaces?.[namespace]?.recordCount ?? 0 > 0) {
        console.log(`Found namespace "${namespace}" in index: ${indexName}`);
        return { indexName, index };
      }
    } catch (error) {
      console.warn(`Error checking index ${indexName}:`, error);
    }
    return null;
  });

  // Wait for all checks and return the first valid result
  const results = await Promise.all(checks);
  const found = results.find((result) => result !== null);

  if (found) {
    return found;
  }

  console.log(`Namespace "${namespace}" not found in any configured index`);
  return null;
};
