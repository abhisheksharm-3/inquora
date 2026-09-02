import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import type { ModelConfig } from "./llm.types";
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE, MAX_RETRIES } from "./llm.constants";

/**
 * The model layer, per ADR 0002: a provider string names the model, and nothing
 * outside this module constructs one, so changing provider is a change here and
 * nowhere else.
 *
 * It does not use `initChatModel`, which is what the ADR named. initChatModel
 * resolves the provider package with a fully dynamic import, and a bundler cannot
 * trace that: the deployed route failed with "Cannot find module as expression is
 * too dynamic" while every local test passed, because locally the import resolves
 * against node_modules. Marking the packages external did not help — the
 * transformation happens at build time. So the providers are a static map, which
 * keeps the provider-string contract and removes the whole class of failure.
 */

/** Providers this deployment can reach. Adding one is an import and a line. */
const PROVIDERS = {
  "google-genai": (model: string, apiKey: string, temperature: number) =>
    new ChatGoogleGenerativeAI({
      model,
      apiKey,
      temperature,
      maxRetries: MAX_RETRIES,
    }) as unknown as BaseChatModel,
} as const;

export const createChatModel = async ({
  apiKey,
  model = DEFAULT_MODEL,
  temperature = DEFAULT_TEMPERATURE,
}: ModelConfig): Promise<Result<BaseChatModel, AppError>> => {
  if (!apiKey) {
    return err(AppError.misconfigured("GEMINI_API_KEY is not set, so no answer can be generated"));
  }

  const separator = model.indexOf(":");

  if (separator === -1) {
    return err(
      AppError.misconfigured(`"${model}" is not a provider:model string, so no provider is named`),
    );
  }

  const provider = model.slice(0, separator);
  const name = model.slice(separator + 1);
  const build = PROVIDERS[provider as keyof typeof PROVIDERS];

  if (!build) {
    return err(
      AppError.misconfigured(
        `${provider} is not a configured provider; add it to PROVIDERS in this file`,
      ),
    );
  }

  try {
    return ok(build(name, apiKey, temperature));
  } catch (cause) {
    return err(
      AppError.misconfigured(
        `could not initialise ${model}: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
};
