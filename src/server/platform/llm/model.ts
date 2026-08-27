import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

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
      // Three attempts, because the shared Gemini capacity answers 503 "this
      // model is currently experiencing high demand" often enough that one
      // attempt loses a whole answer to it.
      maxRetries: 3,
    }) as unknown as BaseChatModel,
} as const;

/**
 * Default answering model. A pinned version rather than the -latest alias: the
 * alias points at whatever is newest, which is also what everyone else is
 * pointing at, and it answered 503 on the first deployed run.
 *
 * Overridable through ANSWER_MODEL, so changing model is a variable rather than a
 * deploy.
 */
const DEFAULT_MODEL = "google-genai:gemini-2.5-flash";

export interface ModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

export const createChatModel = async ({
  apiKey,
  model = DEFAULT_MODEL,
  temperature = 0.2,
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
