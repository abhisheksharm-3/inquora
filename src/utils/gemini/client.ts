"use server";

import {
  GoogleGenerativeAI,
  GenerativeModel,
  StartChatParams,
  Content,
  Part,
  FunctionDeclaration,
} from "@google/generative-ai";
import { createYoutubeSystemPrompt } from "../youtube-utils";
import { createAgenticRagPrompt } from "../rag/prompt-engineering";
import { TypeGeminiImageData } from "@/types/content";
import { SupabaseClient } from "@supabase/supabase-js";
import { manageMemory, memoryToolDefinition, MemoryAction } from "./memory-tool";
import { GeminiUserContext, GeminiMessage } from "@/types/gemini";
import { env, isGeminiConfigured as checkGeminiConfigured } from "@/config/env";
import {
  GEMINI_GENERATION_CONFIG,
  GEMINI_SAFETY_SETTINGS,
  GEMINI_MODEL_NAME,
} from "@/config/gemini-config";
import { geminiRateLimiter } from "../rag/rate-limiter";

let genAI: GoogleGenerativeAI | undefined;
if (env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

/**
 * Checks if the Gemini API has been configured with an API key.
 */
export const isGeminiConfigured = async (): Promise<boolean> => checkGeminiConfigured();

/**
 * Retrieves the configured Gemini generative model.
 * @returns {GenerativeModel} An instance of the Gemini model.
 * @throws {Error} If the Gemini API key is not configured.
 */
const getGeminiModel = async (): Promise<GenerativeModel> => {
  if (!genAI) {
    throw new Error("Gemini API key is not configured.");
  }
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL_NAME,
    tools: [{
      functionDeclarations: [memoryToolDefinition] as FunctionDeclaration[]
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
 * @param supabaseClient Optional Supabase client for memory tool (server-side only).
 * @returns A promise that resolves to the model's text response.
 */
export const sendMessageToGemini = async (
  messages: GeminiMessage[],
  fileContent?: string,
  imageData?: TypeGeminiImageData,
  context?: GeminiUserContext,
  supabaseClient?: SupabaseClient,
): Promise<string> => {
  if (!isGeminiConfigured()) {
    return "Error: Gemini API key is not configured.";
  }

  try {
    const model = await getGeminiModel();
    const lastIndex = messages.length - 1;
    const lastUserMessage = lastIndex >= 0 ? messages[lastIndex] : undefined;
    const historyMessages = lastIndex >= 0 ? messages.slice(0, lastIndex) : messages;
    if (!lastUserMessage) {
      return "Error: No message to send.";
    }

    const history: Content[] = [];
    const systemInstruction = await _getSystemInstruction(fileContent, context);
    if (systemInstruction) {
      history.push(systemInstruction);
    }

    historyMessages.forEach((msg) => {
      history.push({ role: msg.role, parts: [{ text: msg.content }] });
    });

    const chatParams: StartChatParams = {
      history,
      generationConfig: GEMINI_GENERATION_CONFIG,
      safetySettings: [...GEMINI_SAFETY_SETTINGS],
    };

    const chat = model.startChat(chatParams);

    const messageParts: Part[] = [{ text: lastUserMessage.content }];
    if (imageData) {
      messageParts.push({
        inlineData: {
          data: imageData.buffer.toString("base64"),
          mimeType: imageData.mimeType,
        },
      });
    }

    let result = await geminiRateLimiter.execute(() => chat.sendMessage(messageParts));
    let response = result.response;

    const MAX_TOOL_LOOPS = 5;
    let loopCount = 0;

    while (loopCount < MAX_TOOL_LOOPS) {
      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        break; // No tool called, we are done
      }

      const functionResponses = await Promise.all(functionCalls.map(async (call) => {
        if (call.name === "manage_memory") {
          if (!context?.userId || !supabaseClient) {
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
          const toolResult = await manageMemory(context.userId, args.action, args.content, supabaseClient);

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

      result = await geminiRateLimiter.execute(() => chat.sendMessage(functionResponses));
      response = result.response;
      loopCount++;
    }

    return response.text();
  } catch (error) {
    console.error("Error in Gemini chat:", error);

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
