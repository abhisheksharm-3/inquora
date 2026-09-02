import { STATUS_CODES } from "node:http";
import type { AppError } from "@/core/errors";
import type { ProblemDetails } from "./http.types";

/**
 * Renders an error as a problem document. The title comes from Node's own
 * STATUS_CODES, so the standard reason phrases are not restated here.
 */
export const toProblemDetails = (error: AppError, instance: string): ProblemDetails => ({
  type: error.type,
  title: STATUS_CODES[error.status] ?? "Error",
  status: error.status,
  ...(error.detail === undefined ? {} : { detail: error.detail }),
  instance,
});

/** The same document as a Response, with Retry-After when the error carries one. */
export const problemResponse = (error: AppError, instance: string): Response =>
  new Response(JSON.stringify(toProblemDetails(error, instance)), {
    status: error.status,
    headers: {
      "content-type": "application/problem+json",
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { "retry-after": String(error.retryAfterSeconds) }),
    },
  });
