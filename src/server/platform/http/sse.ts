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

      /**
       * Once the consumer goes away the controller is closed and every write
       * throws. A throw here used to escape `start`, which skipped both the
       * completion hook and the close: the answer was generated, paid for, and
       * never stored. So a write that fails is the end of the stream, not the end
       * of the work.
       */
      const write = (frame: string): boolean => {
        try {
          controller.enqueue(encoder.encode(frame));
          return true;
        } catch {
          return false;
        }
      };

      try {
        for await (const event of source) {
          if (signal?.aborted) {
            reason = "aborted";
            break;
          }

          if (!write(encodeEvent(event.event, event.data))) {
            reason = "aborted";
            break;
          }
        }
      } catch (error) {
        // A cancelled generation raises here as an AbortError, which is the
        // client's own decision rather than a failure to report as one.
        const aborted = signal?.aborted || (error instanceof Error && error.name === "AbortError");

        reason = aborted ? "aborted" : "failed";

        if (!aborted) {
          failure = error;

          // An error mid-stream cannot become a status code: the headers are long
          // gone. It goes down the channel as an event, so the client knows the
          // difference between a failure and a finished answer.
          write(
            encodeEvent("error", {
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      write("data: [DONE]\n\n");

      // Whatever happened above, the work that was done is recorded before the
      // stream closes.
      try {
        await onFinish?.(reason, failure);
      } catch {
        // A persistence failure must not replace the reason the stream ended.
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the cancel that brought us here.
        }
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
