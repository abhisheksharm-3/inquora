import type { FinishReason, SseOptions, StreamEvent } from "./http.types";

/**
 * Server-sent events, in the shape LangGraph's own stream uses: a named event
 * and a JSON payload.
 *
 * Nothing here invents a protocol. ADR 0005 settles that the wire format is
 * LangGraph's, because LangChain v1's createAgent is LangGraph underneath and
 * the React runtime already reads that stream. This module only frames it.
 */

/** One SSE frame. JSON.stringify escapes the newlines that would break framing. */
export const encodeEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const streamToSse = (
  source: AsyncIterable<StreamEvent>,
  { signal, onFinish }: SseOptions = {},
): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let reason: FinishReason = "completed";
      let failure: unknown;

      try {
        for await (const event of source) {
          if (signal?.aborted) {
            reason = "aborted";
            break;
          }

          controller.enqueue(encoder.encode(encodeEvent(event.event, event.data)));
        }
      } catch (error) {
        reason = "failed";
        failure = error;

        // An error mid-stream cannot become a status code: the headers are long
        // gone. It goes down the channel as an event, so the client knows the
        // difference between a failure and a finished answer.
        controller.enqueue(
          encoder.encode(
            encodeEvent("error", {
              message: error instanceof Error ? error.message : String(error),
            }),
          ),
        );
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      try {
        await onFinish?.(reason, failure);
      } finally {
        controller.close();
      }
    },
  });
};

/** The response headers an SSE stream needs, including the one that defeats proxy buffering. */
export const sseHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
} as const;
