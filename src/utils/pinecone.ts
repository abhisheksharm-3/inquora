"use server";

import { Pinecone, Index } from "@pinecone-database/pinecone";

// Singleton instances for the Pinecone client and index cache
let pineconeClientInstance: Pinecone | null = null;
const pineconeIndexCache: Map<string, Index> = new Map();

/**
 * Retrieves the singleton Pinecone client instance.
 * Initializes the client on the first call.
 * @returns {Promise<Pinecone>} A promise that resolves to the Pinecone client instance.
 * @throws {Error} If the PINECONE_API_KEY environment variable is not set.
 * @throws {Error} If the Pinecone client fails to initialize.
 */
export const getPineconeClient = async (): Promise<Pinecone> => {
  if (pineconeClientInstance) {
    return pineconeClientInstance;
  }

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY environment variable is not set.");
  }

  try {
    console.log("Initializing Pinecone client...");
    pineconeClientInstance = new Pinecone({ apiKey });
    console.log("Pinecone client initialized successfully.");
    return pineconeClientInstance;
  } catch (error) {
    console.error("Failed to initialize Pinecone client:", error);
    throw new Error("Failed to initialize Pinecone client.");
  }
};

/**
 * Gets all configured Pinecone index names (current + legacy)
 * @returns {Promise<string[]>} Array of index names to check
 */
export const getAllIndexNames = async (): Promise<string[]> => {
  const currentIndex = process.env.PINECONE_INDEX_NAME;
  const legacyIndexes = process.env.PINECONE_LEGACY_INDEX_NAMES?.split(',').map(name => name.trim()) || [];
  
  const allIndexes = currentIndex ? [currentIndex, ...legacyIndexes] : legacyIndexes;
  return [...new Set(allIndexes)]; // Remove duplicates
};

/**
 * Retrieves a Pinecone index instance by name (with caching).
 * @param {string} indexName - Optional specific index name. Defaults to PINECONE_INDEX_NAME env var.
 * @returns {Promise<Index>} A promise that resolves to the Pinecone index instance.
 * @throws {Error} If the index name is not provided or found in env.
 * @throws {Error} If the Pinecone index fails to initialize.
 */
export const getPineconeIndex = async (indexName?: string): Promise<Index> => {
  const targetIndexName = indexName || process.env.PINECONE_INDEX_NAME;
  
  if (!targetIndexName) {
    throw new Error("PINECONE_INDEX_NAME environment variable is not set and no index name provided.");
  }

  // Check cache first
  if (pineconeIndexCache.has(targetIndexName)) {
    return pineconeIndexCache.get(targetIndexName)!;
  }

  try {
    const client = await getPineconeClient();
    console.log(`Getting Pinecone index: ${targetIndexName}`);
    const index = client.Index(targetIndexName);
    
    // Cache the index instance
    pineconeIndexCache.set(targetIndexName, index);
    
    console.log(`Pinecone index ${targetIndexName} retrieved and cached successfully.`);
    return index;
  } catch (error) {
    console.error(`Failed to initialize Pinecone index ${targetIndexName}:`, error);
    throw new Error(`Failed to initialize Pinecone index ${targetIndexName}.`);
  }
};

/**
 * Checks if the necessary Pinecone environment variables are configured.
 * @returns {boolean} True if both PINECONE_API_KEY and PINECONE_INDEX_NAME are set, otherwise false.
 */
export const isPineconeConfigured = async (): Promise<boolean> => {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  return !!apiKey && !!indexName;
};

/**
 * Attempts to find which index contains the given namespace.
 * Checks current index first, then falls back to legacy indexes.
 * @param {string} namespace - The namespace to search for
 * @returns {Promise<{indexName: string, index: Index} | null>} The index info if found, null otherwise
 */
export const findIndexForNamespace = async (
  namespace: string
): Promise<{indexName: string, index: Index} | null> => {
  const allIndexNames = await getAllIndexNames();
  
  if (allIndexNames.length === 0) {
    console.warn("No Pinecone indexes configured");
    return null;
  }

  // Try current index first
  const currentIndexName = process.env.PINECONE_INDEX_NAME;
  if (currentIndexName) {
    try {
      const currentIndex = await getPineconeIndex(currentIndexName);
      const stats = await currentIndex.describeIndexStats();
      
      if (stats.namespaces?.[namespace]?.recordCount ?? 0 > 0) {
        console.log(`Found namespace "${namespace}" in current index: ${currentIndexName}`);
        return { indexName: currentIndexName, index: currentIndex };
      }
    } catch (error) {
      console.warn(`Error checking current index ${currentIndexName}:`, error);
    }
  }

  // Try legacy indexes
  const legacyIndexes = allIndexNames.filter(name => name !== currentIndexName);
  
  for (const legacyIndexName of legacyIndexes) {
    try {
      const legacyIndex = await getPineconeIndex(legacyIndexName);
      const stats = await legacyIndex.describeIndexStats();
      
      if (stats.namespaces?.[namespace]?.recordCount ?? 0 > 0) {
        console.log(`Found namespace "${namespace}" in legacy index: ${legacyIndexName}`);
        return { indexName: legacyIndexName, index: legacyIndex };
      }
    } catch (error) {
      console.warn(`Error checking legacy index ${legacyIndexName}:`, error);
    }
  }

  console.log(`Namespace "${namespace}" not found in any configured index`);
  return null;
};
