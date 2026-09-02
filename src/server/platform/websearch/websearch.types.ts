import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";

/** One web result, already extracted, so nothing has to fetch the page. */
export interface WebResult {
  title: string;
  url: string;
  extract: string;
}

export interface WebSearchClient {
  readonly configured: boolean;
  search(query: string, limit?: number): Promise<Result<WebResult[], AppError>>;
}
