

import { Embeddings } from "@langchain/core/embeddings";
import { generateEmbeddings } from "../multiutility-api";

/**
 * Custom embeddings implementation using the multiutility API.
 *
 * Returns 1024-dimensional vectors compatible with Pinecone and LangChain.
 * Implements the LangChain Embeddings interface for seamless integration
 * with PineconeStore and other vector store implementations.
 */
export class CustomEmbeddings extends Embeddings {
  readonly dimensions = 1024;
  readonly modelName = "custom-sentence-transformer";

  constructor() {
    super({});
  }

  /**
   * Embeds a list of documents/texts.
   * Used when storing documents in a vector store.
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors (1024-dimensional each)
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Filter out empty/whitespace-only texts
    const validTexts = texts.filter((text) => text && text.trim().length > 0);

    if (validTexts.length === 0) {
      console.warn("All provided texts were empty, returning empty embeddings");
      return [];
    }

    const response = await generateEmbeddings(validTexts, true);
    return response.embeddings;
  }

  /**
   * Embeds a single query text.
   * Used when performing similarity search.
   *
   * @param text - The query text to embed
   * @returns A single embedding vector (1024-dimensional)
   */
  async embedQuery(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot embed empty query text");
    }

    const response = await generateEmbeddings([text], true);

    if (response.embeddings.length === 0) {
      throw new Error("Failed to generate embedding for query");
    }

    return response.embeddings[0];
  }
}

/**
 * Factory function to create an embeddings instance.
 *
 * Returns a CustomEmbeddings instance that uses the multiutility API
 * to generate 1024-dimensional embedding vectors.
 *
 * @returns An embeddings instance compatible with LangChain/Pinecone
 */
export const createEmbeddings = async (): Promise<CustomEmbeddings> => {
  return new CustomEmbeddings();
};
