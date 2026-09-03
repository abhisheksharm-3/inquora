"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import type { ChatDetail, Specimen } from "@/core/workspace/workspace.types";
import type { Operation, Turn } from "./conversation.types";

/**
 * One owner for the conversation.
 *
 * The system this replaces ran TanStack Query, `useOptimistic` and a realtime
 * channel over the same array and reconciled them by hand, including a reducer
 * that found an optimistic message by the string prefix `temp-ai-`. Any of the
 * three could win a race, and the visible bug was an answer that appeared twice.
 *
 * Here the stream is the only writer. A turn is created when the question is
 * sent, filled in as tokens arrive, and finished when the stream ends. The
 * server has already persisted it by then, so nothing needs reconciling: a
 * navigation away and back re-reads the turn from the database.
 */
export const useConversation = (chat: ChatDetail) => {
  const [turns, setTurns] = useState<Turn[]>(() => toTurns(chat));
  const [pending, startTransition] = useTransition();
  const abort = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, next: (turn: Turn) => Turn) => {
    setTurns((current) => current.map((turn) => (turn.id === id ? next(turn) : turn)));
  }, []);

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || abort.current) return;

      /*
       * The same question, twice in a row, is a repeat rather than a question.
       *
       * `abort.current` only guards a send still in flight. A send that
       * finished — including one that finished with nothing, in under a second
       * — leaves nothing in flight, so a second Enter created a second turn
       * with the same words and its own client id, which the server treats as
       * a genuinely new message. Two identical empty turns is what that looks
       * like.
       */
      if (turns.at(-1)?.question === trimmed && turns.at(-1)?.status !== "failed") return;

      // The client's own id, which is what makes the send idempotent: a
      // double-click or a retrying proxy reaches the same row rather than
      // paying for a second agent run.
      const id = crypto.randomUUID();
      const startedAt = performance.now();

      setTurns((current) => [
        ...current,
        {
          id,
          question: trimmed,
          answer: "",
          operations: [],
          specimens: [],
          status: "streaming",
        },
      ]);

      const controller = new AbortController();
      abort.current = controller;

      startTransition(async () => {
        try {
          const response = await fetch(`/api/chats/${chat.id}/messages`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: trimmed, clientMessageId: id, parentId: null }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            const detail = await problemOf(response);
            patch(id, (turn) => ({ ...turn, status: "failed", error: detail }));
            return;
          }

          for await (const event of readEvents(response.body, controller.signal)) {
            applyEvent(event, id, startedAt, patch);
          }

          patch(id, (turn) => ({
            ...turn,
            status: turn.status === "streaming" ? "complete" : turn.status,
            totalMs: performance.now() - startedAt,
          }));
        } catch (error) {
          const aborted = error instanceof DOMException && error.name === "AbortError";

          patch(id, (turn) => ({
            ...turn,
            status: aborted ? "aborted" : "failed",
            // An aborted answer keeps what it produced, because the server keeps
            // it too: the stream's onFinish persists a partial answer.
            error: aborted ? undefined : "The connection dropped before the answer finished.",
          }));
        } finally {
          abort.current = null;
        }
      });
    },
    [chat.id, patch, turns],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  return { turns, send, stop, streaming: pending || abort.current !== null };
};

/** What the server has already stored, as turns. */
const toTurns = (chat: ChatDetail): Turn[] => {
  const turns: Turn[] = [];

  for (const message of chat.messages) {
    const text = message.parts
      .filter((part) => part.kind === "text" && part.text)
      .map((part) => part.text)
      .join("");

    if (message.role === "user") {
      turns.push({
        id: message.id,
        question: text,
        answer: "",
        questionMessageId: message.id,
        operations: [],
        specimens: [],
        status: "complete",
      });
      continue;
    }

    // Numbered in the order they were cited, which is the order the parts were
    // written, so a reloaded turn shows the same numbers as the live one did.
    const specimens: Specimen[] = message.parts
      .filter((part) => part.kind === "source" && part.passage)
      .map((part, index) => ({ ...(part.passage as Specimen), number: index + 1 }));

    // An assistant message answers the question above it. A conversation that
    // opens with an assistant message is not a shape the send path can produce,
    // so it gets its own turn rather than being dropped.
    const open = turns.at(-1);

    if (open && open.answer === "") {
      open.answer = text;
      open.answerMessageId = message.id;
      open.specimens = specimens;
      open.totalMs = message.latencyMs ?? undefined;
      continue;
    }

    turns.push({
      id: message.id,
      question: "",
      answer: text,
      answerMessageId: message.id,
      operations: [],
      specimens,
      status: "complete",
      totalMs: message.latencyMs ?? undefined,
    });
  }

  return turns;
};

type StreamEvent = { event: string; data: unknown };

/**
 * Server-sent events, parsed by hand.
 *
 * `EventSource` cannot POST and cannot be aborted, and a library for this is
 * forty lines of framing: split on a blank line, read the `event:` and `data:`
 * fields. The buffer keeps the tail because a frame can straddle two chunks,
 * which is the bug every hand-rolled parser has until it is written this way.
 */
async function* readEvents(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const parsed = parseFrame(frame);
        if (parsed) yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const parseFrame = (frame: string): StreamEvent | null => {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }

  if (data.length === 0) return null;

  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
};

/**
 * The wire is LangGraph's own message stream, so a chunk is a message-shaped
 * object: text deltas from the model, and tool calls from the tools node.
 */
const applyEvent = (
  { event, data }: StreamEvent,
  id: string,
  startedAt: number,
  patch: (id: string, next: (turn: Turn) => Turn) => void,
) => {
  if (event === "specimen") {
    const specimen = data as Specimen;

    patch(id, (turn) =>
      turn.specimens.some((existing) => existing.number === specimen.number)
        ? turn
        : { ...turn, specimens: [...turn.specimens, specimen] },
    );

    return;
  }

  if (event !== "messages/partial") return;

  const [chunk] = Array.isArray(data) ? (data as MessageChunk[]) : [];
  if (!chunk) return;

  const text = typeof chunk.content === "string" ? chunk.content : "";
  const calls = Array.isArray(chunk.tool_calls) ? chunk.tool_calls : [];

  patch(id, (turn) => {
    const next: Turn = { ...turn };

    if (text && chunk.type === "ai") {
      next.answer = turn.answer + text;
      next.firstTokenMs = turn.firstTokenMs ?? performance.now() - startedAt;
    }

    for (const call of calls) {
      if (!call?.name || next.operations.some((operation) => operation.name === call.name))
        continue;

      next.operations = [...next.operations, toOperation(call)];
    }

    // A tool result closes the operation it belongs to, which is what gives the
    // apparatus a real duration rather than a spinner.
    if (chunk.type === "tool" && chunk.name) {
      next.operations = next.operations.map((operation) =>
        operation.name === chunk.name && operation.durationMs === undefined
          ? { ...operation, durationMs: performance.now() - operation.startedAt }
          : operation,
      );
    }

    return next;
  });
};

type MessageChunk = {
  type?: string;
  name?: string;
  content?: unknown;
  tool_calls?: { name?: string; args?: Record<string, unknown> }[];
};

const toOperation = (call: { name?: string; args?: Record<string, unknown> }): Operation => ({
  name: call.name ?? "unknown",
  argument: describeArguments(call.args),
  startedAt: performance.now(),
});

/** The first string argument, which for every tool here is the interesting one. */
const describeArguments = (args?: Record<string, unknown>): string | undefined => {
  if (!args) return undefined;

  const value = Object.values(args).find((entry) => typeof entry === "string" && entry.length > 0);

  return typeof value === "string" ? value : undefined;
};

/** The RFC 9457 problem document the route returns, as a sentence. */
const problemOf = async (response: Response): Promise<string> => {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };

    return problem.detail ?? problem.title ?? `The server answered ${response.status}.`;
  } catch {
    return `The server answered ${response.status}.`;
  }
};
