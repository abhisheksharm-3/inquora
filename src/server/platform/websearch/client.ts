import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { WebResult, WebSearchClient } from "./websearch.types";

/**
 * Web search, through whichever provider is configured.
 *
 * Off unless a key exists, because the product's claim is that an answer comes
 * from your documents. Reaching the open web changes what an answer means, so it
 * is a per-conversation decision rather than a capability that is quietly always
 * on, and its citations are marked differently.
 *
 * A search API that returns extracted content, rather than a scraper: nothing
 * here fetches an arbitrary URL, which is the failure mode fetch-external exists
 * to guard and which a search tool would otherwise reintroduce at scale.
 */
export const createWebSearchClient = ({
  apiKey,
  timeoutMs = 20_000,
}: {
  apiKey?: string;
  timeoutMs?: number;
}): WebSearchClient => ({
  configured: Boolean(apiKey),

  async search(query, limit = 5) {
    if (!apiKey) {
      return err(AppError.misconfigured("web search is not configured on this deployment"));
    }

    let response: Response;

    try {
      response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query,
          max_results: Math.min(Math.max(limit, 1), 10),
          include_answer: false,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      return err(
        AppError.badGateway(
          `the search provider did not answer: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }

    if (response.status === 429) {
      return err(AppError.rateLimited(30, "the search provider is throttling"));
    }

    if (!response.ok) {
      return err(AppError.badGateway(`the search provider returned ${response.status}`));
    }

    const body = (await response.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };

    return ok(
      (body.results ?? [])
        .filter((result): result is { title?: string; url: string; content: string } =>
          Boolean(result.url && result.content),
        )
        .map((result): WebResult => ({
          title: result.title ?? result.url,
          url: result.url,
          extract: result.content.slice(0, 1200),
        })),
    );
  },
});
