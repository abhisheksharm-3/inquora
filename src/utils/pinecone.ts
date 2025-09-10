"use server";

import { Pinecone, Index } from "@pinecone-database/pinecone";

// Singleton instances for the Pinecone client and index.
let pineconeClientInstance: Pinecone | null = null;
let pineconeIndexInstance: Index | null = null;

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
 * Retrieves the singleton Pinecone index instance.
 * Initializes the index on the first call.
 * @returns {Promise<Index>} A promise that resolves to the Pinecone index instance.
 * @throws {Error} If the PINECONE_INDEX_NAME environment variable is not set.
 * @throws {Error} If the Pinecone index fails to initialize.
 */
export const getPineconeIndex = async (): Promise<Index> => {
  if (pineconeIndexInstance) {
    return pineconeIndexInstance;
  }

  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) {
    throw new Error("PINECONE_INDEX_NAME environment variable is not set.");
  }

  try {
    const client = await getPineconeClient();
    console.log(`Getting Pinecone index: ${indexName}`);
    pineconeIndexInstance = client.Index(indexName);
    console.log("Pinecone index retrieved successfully.");
    return pineconeIndexInstance;
  } catch (error) {
    console.error("Failed to initialize Pinecone index:", error);
    throw new Error("Failed to initialize Pinecone index.");
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
