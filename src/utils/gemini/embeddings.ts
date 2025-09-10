"use server";

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * Creates and initializes a GoogleGenerativeAIEmbeddings instance.
 *
 * This factory function ensures that the necessary API key is available and
 * configures the client with a specified or default model.
 *
 * @returns An instance of `GoogleGenerativeAIEmbeddings`.
 * @throws An error if the Gemini API key is not provided via parameters or environment variables.
 */
export const createGeminiEmbeddings =
  async (): Promise<GoogleGenerativeAIEmbeddings> => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key is missing. Please provide it via the `apiKey` parameter or set the GEMINI_API_KEY environment variable.",
      );
    }

    return new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: "text-embedding-004",
    });
  };
