import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import {
  EMBEDDING_DIMENSIONS,
  MAX_INLINE_WAIT_SECONDS,
  QUERY_TIMEOUT_MS,
} from "./embeddings.constants";
import type { EmbeddingsClient, EmbeddingsConfig, EmbeddingsResponse } from "./embeddings.types";

const retryAfterSeconds = (response: Response): number => {
  const header = response.headers.get("retry-after");
  const parsed = header === null ? NaN : Number(header);
  return Number.isFinite(parsed) ? parsed : 5;
};

/**
 * The Hugging Face Space that serves embeddings, as one client.
 *
 * The endpoint takes an array, so a 500-chunk document is roughly five calls
 * rather than a hundred. The old ingestion path sent five chunks and then slept
 * five seconds, spending about eight minutes idle on a document that size.
 *
 * `fetch` is injectable so the failure paths are testable without a network. The
 * cache lives one layer up, in the retrieval service, because ingestion embeds
 * text that will never be embedded again and should not evict query vectors.
 */
export const createEmbeddingsClient = (config: EmbeddingsConfig): EmbeddingsClient => {
  const doFetch = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? QUERY_TIMEOUT_MS;

  const request = async (texts: string[]): Promise<Response> =>
    doFetch(`${config.baseUrl}/api/v1/embeddings/generate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": config.apiKey },
      body: JSON.stringify({ texts, normalize: true }),
      signal: AbortSignal.timeout(timeoutMs),
    });

  return {
    async embed(texts) {
      if (texts.length === 0) return ok([]);

      let response: Response;

      try {
        response = await request(texts);

        // One retry, because a cold Space rate-limits before it is warm, but
        // only when the wait is short. A longer delay is the caller's to decide
        // about, with the delay attached so it need not guess.
        if (response.status === 429 && retryAfterSeconds(response) <= MAX_INLINE_WAIT_SECONDS) {
          await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds(response) * 1000));
          response = await request(texts);
        }
      } catch (cause) {
        return err(
          AppError.badGateway(
            `the embeddings provider did not answer: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
        );
      }

      if (response.status === 429) {
        return err(
          AppError.rateLimited(
            retryAfterSeconds(response),
            "the embeddings provider is throttling",
          ),
        );
      }

      if (!response.ok) {
        return err(AppError.badGateway(`the embeddings provider returned ${response.status}`));
      }

      let body: EmbeddingsResponse;

      try {
        body = (await response.json()) as EmbeddingsResponse;
      } catch {
        return err(AppError.badGateway("the embeddings provider returned a body that is not JSON"));
      }

      if (!Array.isArray(body.embeddings) || body.embeddings.length !== texts.length) {
        return err(
          AppError.badGateway(
            `asked for ${texts.length} embeddings and received ${body.embeddings?.length ?? 0}`,
          ),
        );
      }

      // A vector of the wrong width is a schema change at the provider, and
      // storing it would poison the index silently: the column is declared
      // vector(1024) and every comparison assumes it.
      const wrong = body.embeddings.find((v) => v.length !== EMBEDDING_DIMENSIONS);

      if (wrong) {
        return err(
          AppError.badGateway(
            `expected ${EMBEDDING_DIMENSIONS} dimensions and received ${wrong.length}`,
          ),
        );
      }

      return ok(body.embeddings);
    },
  };
};
