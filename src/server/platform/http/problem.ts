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
 * describe the schema to whoever asked. In production it goes to the trace
 * instead; in development it is sent, because there the reader is the person
 * who can fix it.
 */
export const toProblemDetails = (error: AppError, instance: string): ProblemDetails => {
  /*
   * A 5xx detail is shared in development and withheld in production.
   *
   * Withholding it is right: constraint names, column names, provider messages
   * and configuration state describe the schema to whoever asked. But locally
   * it makes the application undiagnosable from the browser — "GEMINI_API_KEY
   * is not set" arrives as "something on our side failed", and the person
   * reading it is the person who can fix it.
   */
  const shareable = error.status < 500 || process.env.NODE_ENV !== "production";

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

/**
 * The same document as a Response, with Retry-After when the error carries one.
 *
 * A 5xx detail is withheld from the client and written to the server log instead.
 * Hiding it without recording it anywhere is how a deployment becomes
 * undiagnosable: the first version of this hid the detail and logged nothing, so
 * "SUPABASE_SERVICE_ROLE_KEY is not set" became "something on our side failed"
 * and stayed that way.
 */
export const problemResponse = (error: AppError, instance: string): Response => {
  if (error.status >= 500) {
    console.error(`[${error.status}] ${instance}: ${error.detail ?? error.type}`);
  }

  return new Response(JSON.stringify(toProblemDetails(error, instance)), {
    status: error.status,
    headers: {
      "content-type": "application/problem+json",
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { "retry-after": String(error.retryAfterSeconds) }),
    },
  });
};
