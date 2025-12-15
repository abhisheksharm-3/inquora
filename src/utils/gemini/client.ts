"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerativeModel,
  StartChatParams,
  Content,
  Part,
  FunctionDeclaration,
} from "@google/generative-ai";
import { createYoutubeSystemPrompt } from "../youtube-utils";
import { createAgenticRagPrompt } from "../rag/prompt-engineering";
import { TypeGeminiImageData } from "@/types/TypeContent";
import { TypeSessionMetadata } from "@/types/TypeRag";
import { manageMemory, memoryToolDefinition, MemoryAction } from "./memory-tool";
import { SupabaseClient } from "@supabase/supabase-js";
import { GeminiUserContext, GeminiMessage } from "@/types/TypeGemini";

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

// --- Initialization ---
let genAI: GoogleGenerativeAI | undefined;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

/**
 * Checks if the Gemini API has been configured with an API key.
 * @returns {boolean} True if the API key is set, otherwise false.
 */
export const isGeminiConfigured = async (): Promise<boolean> => !!API_KEY;

/**
 * Retrieves the configured Gemini generative model.
 * @returns {GenerativeModel} An instance of the Gemini model.
 * @throws {Error} If the Gemini API key is not configured.
 */
const getGeminiModel = async (): Promise<GenerativeModel> => {
  if (!genAI) {
    throw new Error("Gemini API key is not configured.");
  }
  console.log("Using model:", MODEL_NAME);
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    tools: [{
      functionDeclarations: [memoryToolDefinition] as unknown as FunctionDeclaration[]
    }]
  });
};

/**
 * Determines the appropriate system instruction based on file content.
 * @private
 */
const _getSystemInstruction = async (
  fileContent?: string,
  context?: GeminiUserContext,
): Promise<Content | null> => {
  if (!fileContent || fileContent === "IMAGE_FILE") {
    return null; // No system prompt needed for images or standard chat
  }

  let promptText: string;

  if (fileContent === "YOUTUBE_TRANSCRIPT") {
    promptText = createYoutubeSystemPrompt(fileContent, context);
  } else {
    // Always use advanced RAG prompt
    promptText = await createAgenticRagPrompt(fileContent, context);
  }

  return {
    role: "user",
    parts: [{ text: `System Instruction: ${promptText}` }],
  };
};

/**
 * Sends a message history to the Gemini API and returns the model's response.
 *
 * @param messages The history of the conversation.
 * @param fileContent Optional context from a file (e.g., PDF content or a placeholder like 'YOUTUBE_TRANSCRIPT').
 * @param imageData Optional image data to include in the message.
 * @param context Optional context information including date/time and user details.
 * @returns {Promise<string>} A promise that resolves to the model's text response.
 */
export const sendMessageToGemini = async (
  messages: GeminiMessage[],
  fileContent?: string,
  imageData?: TypeGeminiImageData,
  context?: GeminiUserContext,
): Promise<string> => {
  if (!isGeminiConfigured()) {
    return "Error: Gemini API key is not configured.";
  }

  try {
    const model = await getGeminiModel();
    const lastUserMessage = messages.pop(); // Remove the last message to send it separately
    if (!lastUserMessage) {
      return "Error: No message to send.";
    }

    // Construct the chat history, including the system prompt if applicable.
    const history: Content[] = [];
    const systemInstruction = await _getSystemInstruction(fileContent, context);
    if (systemInstruction) {
      history.push(systemInstruction);
    }

    // Add the rest of the chat history
    messages.forEach((msg) => {
      history.push({ role: msg.role, parts: [{ text: msg.content }] });
    });

    const chatParams: StartChatParams = {
      history,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    };

    const chat = model.startChat(chatParams);

    // Prepare the final message parts, including image data if present.
    const messageParts: Part[] = [{ text: lastUserMessage.content }];
    if (imageData) {
      messageParts.push({
        inlineData: {
          data: imageData.buffer.toString("base64"),
          mimeType: imageData.mimeType,
        },
      });
    }

    let result = await chat.sendMessage(messageParts);
    let response = result.response;

    // Handle Function Calls (Tool Usage)
    const MAX_TOOL_LOOPS = 5;
    let loopCount = 0;

    while (loopCount < MAX_TOOL_LOOPS) {
      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        break; // No tool called, we are done
      }

      // We have function calls to execute
      const functionResponses = await Promise.all(functionCalls.map(async (call) => {
        if (call.name === "manage_memory") {
          if (!context?.userId || !context?.supabase) {
            return {
              functionResponse: {
                name: call.name,
                response: { result: "Error: User ID or Database Client not available for memory management." }
              }
            };
          }

          const args = call.args as { action: MemoryAction; content: string };
          if (!args || typeof args !== "object") {
            return {
              functionResponse: {
                name: call.name,
                response: { result: "Error: Invalid arguments." }
              }
            };
          }
          console.log(`[Gemini Tool] Managing memory: ${args.action} "${args.content}"`);
          const toolResult = await manageMemory(context.userId, args.action, args.content, context.supabase);

          return {
            functionResponse: {
              name: call.name,
              response: { result: toolResult }
            }
          };
        }

        return {
          functionResponse: {
            name: call.name,
            response: { result: "Error: Unknown tool." }
          }
        };
      }));

      // Send tool results back to the model
      result = await chat.sendMessage(functionResponses);
      response = result.response;
      loopCount++;
    }

    return response.text();
  } catch (error) {
    console.error("Error in Gemini chat:", error);

    // Mask sensitive 429 (Quota Exceeded) and 503 (Service Unavailable) errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded")) {
      return "I'm currently receiving too many requests. Please try again in a few moments.";
    }

    if (errorMessage.includes("503") || errorMessage.includes("Service Unavailable")) {
      return "The AI service is temporarily unavailable. Please try again later.";
    }

    return `I'm sorry, I encountered an error. Please try again.`;
  }
};
