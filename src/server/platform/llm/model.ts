import { initChatModel } from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

/**
 * The model layer, per ADR 0002: `initChatModel` with a provider string, so
 * swapping provider is a configuration change rather than a rewrite of the call
 * sites. Nothing outside this module constructs a model.
 */

/**
 * Default answering model. Named here rather than hardcoded at a call site so
 * there is one place to change it, and overridable by environment so a model
 * change does not need a deploy of new code.
 */
const DEFAULT_MODEL = "google-genai:gemini-flash-latest";

export interface ModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

/**
 * initChatModel resolves the provider package at runtime, so it is async. The
 * whole point of the provider string is that this file is the only place that
 * knows which package backs it.
 */
export const createChatModel = async ({
  apiKey,
  model = DEFAULT_MODEL,
  temperature = 0.2,
}: ModelConfig): Promise<Result<BaseChatModel, AppError>> => {
  if (!apiKey) {
    return err(AppError.misconfigured("GEMINI_API_KEY is not set, so no answer can be generated"));
  }

  try {
    return ok(
      (await initChatModel(model, {
        temperature,
        apiKey,
        // The provider is reached once per request; a hung provider must not
        // hold the connection open indefinitely.
        maxRetries: 1,
      })) as unknown as BaseChatModel,
    );
  } catch (cause) {
    return err(
      AppError.misconfigured(
        `could not initialise ${model}: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
};
