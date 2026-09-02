import { STATUS_CODES } from "node:http";
import type { AppError } from "@/core/errors";
import type { ProblemDetails } from "./http.types";

/**
 * Renders an error as a problem document. The title comes from Node's own
 * STATUS_CODES, so the standard reason phrases are not restated here.
 *
 * A 4xx detail is actionable — which field, which limit, which document — and is
 * sent. A 5xx detail is ours: constraint names, column names, provider messages
 * and configuration state, none of which a client can act on and all of which
 * describe the schema to whoever asked. It goes to the trace instead.
 */
export const toProblemDetails = (error: AppError, instance: string): ProblemDetails => {
  const shareable = error.status < 500;

  return {
    type: error.type,
    title: STATUS_CODES[error.status] ?? "Error",
    status: error.status,
    ...(shareable && error.detail !== undefined
      ? { detail: error.detail }
      : error.status >= 500
        ? { detail: "Something on our side failed. The failure is recorded." }
        : {}),
    instance,
  };
};

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
