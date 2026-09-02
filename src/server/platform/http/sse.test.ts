import { describe, expect, it } from "vitest";
import { encodeEvent, streamToSse } from "./sse";

const read = async (stream: ReadableStream<Uint8Array>) => {
  const chunks: string[] = [];
  const decoder = new TextDecoder();

  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(decoder.decode(chunk));
  }

  return chunks.join("");
};

describe("encodeEvent", () => {
  it("writes the event name and JSON payload in SSE framing", () => {
    expect(encodeEvent("messages/partial", [{ content: "hi" }])).toBe(
      'event: messages/partial\ndata: [{"content":"hi"}]\n\n',
    );
  });

  it("keeps a newline inside the payload from breaking the framing", () => {
    const encoded = encodeEvent("messages/partial", [{ content: "line one\nline two" }]);
    expect(encoded.split("\n\n")).toHaveLength(2);
    expect(encoded).toContain("line one\\nline two");
  });
});

describe("streamToSse", () => {
  it("forwards each event and ends with the done sentinel", async () => {
    async function* source() {
      yield { event: "messages/partial", data: [{ content: "a" }] };
      yield { event: "messages/complete", data: [{ content: "ab" }] };
    }

    const body = await read(streamToSse(source()));

    expect(body).toContain("event: messages/partial");
    expect(body).toContain("event: messages/complete");
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("reports a mid-stream failure as an error event rather than a truncated body", async () => {
    async function* source() {
      yield { event: "messages/partial", data: [{ content: "a" }] };
      throw new Error("the provider hung up");
    }

    const body = await read(streamToSse(source()));

    expect(body).toContain("event: error");
    expect(body).toContain("the provider hung up");
  });

  it("stops when the caller aborts, and runs the completion hook", async () => {
    const controller = new AbortController();
    let finished: string | undefined;

    async function* source() {
      yield { event: "messages/partial", data: [{ content: "a" }] };
      controller.abort();
      yield { event: "messages/partial", data: [{ content: "b" }] };
    }

    const body = await read(
      streamToSse(source(), {
        signal: controller.signal,
        onFinish: async (reason) => {
          finished = reason;
        },
      }),
    );

    expect(body).toContain('{"content":"a"}');
    expect(body).not.toContain('{"content":"b"}');
    // An aborted generation still persists what it produced.
    expect(finished).toBe("aborted");
  });

  it("still persists what it produced when the consumer cancels", async () => {
    // The failure this covers: the [DONE] write threw on a cancelled controller,
    // which escaped start(), so the completion hook never ran and a generated,
    // paid-for answer was never stored.
    let finished: string | undefined;

    async function* source() {
      yield { event: "messages/partial", data: [{ content: "a" }] };
      yield { event: "messages/partial", data: [{ content: "b" }] };
      yield { event: "messages/complete", data: [{ content: "ab" }] };
    }

    const stream = streamToSse(source(), {
      onFinish: async (reason) => {
        finished = reason;
      },
    });

    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();

    // The hook runs on the next microtasks, after the write fails.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(finished).toBe("aborted");
  });

  it("reports a cancelled generation as aborted rather than failed", async () => {
    let finished: string | undefined;
    const controller = new AbortController();

    async function* source() {
      yield { event: "messages/partial", data: [{ content: "a" }] };
      controller.abort();
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    }

    await read(
      streamToSse(source(), {
        signal: controller.signal,
        onFinish: async (reason) => {
          finished = reason;
        },
      }),
    );

    // An AbortError is the client's own decision, not a failure to report to it.
    expect(finished).toBe("aborted");
  });

  it("does not let a failing persistence hook mask why the stream ended", async () => {
    async function* source() {
      yield { event: "messages/complete", data: [{ content: "a" }] };
    }

    const body = await read(
      streamToSse(source(), {
        onFinish: async () => {
          throw new Error("the database is down");
        },
      }),
    );

    expect(body).toContain("[DONE]");
  });

  it("tells the completion hook the stream ended normally", async () => {
    let finished: string | undefined;

    async function* source() {
      yield { event: "messages/complete", data: [{ content: "a" }] };
    }

    await read(
      streamToSse(source(), {
        onFinish: async (reason) => {
          finished = reason;
        },
      }),
    );

    expect(finished).toBe("completed");
  });
});
