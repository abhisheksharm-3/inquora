/**
 * Streaming utilities for Gemini API responses.
 * This module is NOT a server action and can be used in API routes.
 */

import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    Content,
    Part,
    StartChatParams,
} from "@google/generative-ai";
import { env, isGeminiConfigured } from "@/config/env";
import { GeminiMessage, GeminiUserContext } from "@/types/gemini";
import { TypeGeminiImageData } from "@/types/content";

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

let genAI: GoogleGenerativeAI | undefined;
if (env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

/**
 * Streams a response from the Gemini API.
 * Yields text chunks as they become available.
 */
export async function* streamGeminiResponse(
    messages: GeminiMessage[],
    fileContent?: string,
    imageData?: TypeGeminiImageData,
    context?: GeminiUserContext,
): AsyncGenerator<string, void, unknown> {
    if (!isGeminiConfigured()) {
        yield "Error: Gemini API key is not configured.";
        return;
    }

    if (!genAI) {
        yield "Error: Gemini client not initialized.";
        return;
    }

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const lastIndex = messages.length - 1;
        const lastUserMessage = lastIndex >= 0 ? messages[lastIndex] : undefined;
        const historyMessages = lastIndex >= 0 ? messages.slice(0, lastIndex) : messages;
        if (!lastUserMessage) {
            yield "Error: No message to send.";
            return;
        }

        const history: Content[] = [];

        if (fileContent && fileContent !== "IMAGE_FILE") {
            history.push({
                role: "user",
                parts: [{ text: `Context: ${fileContent}` }],
            });
        }

        historyMessages.forEach((msg) => {
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
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
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

        const result = await chat.sendMessageStream(messageParts);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                yield chunkText;
            }
        }
    } catch (error) {
        console.error("Error in Gemini streaming:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded")) {
            yield "I'm currently receiving too many requests. Please try again in a few moments.";
        } else if (errorMessage.includes("503") || errorMessage.includes("Service Unavailable")) {
            yield "The AI service is temporarily unavailable. Please try again later.";
        } else {
            yield "I'm sorry, I encountered an error. Please try again.";
        }
    }
}
