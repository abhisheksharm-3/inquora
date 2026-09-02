import type { Specimen } from "@/core/workspace/workspace.types";

/** One tool call, as the apparatus records it. */
export type Operation = {
  name: string;
  /** What it was asked, in one line, from the tool arguments. */
  argument?: string;
  startedAt: number;
  durationMs?: number;
};

/**
 * One turn: the question, the answer as it stands, and what happened while it
 * was produced.
 *
 * A turn rather than a flat message list, because the reading column shows a
 * question with its answer under it, and the apparatus belongs to the turn.
 */
export type Turn = {
  /** The client's own id for the question, which is also the idempotency key. */
  id: string;
  question: string;
  answer: string;
  /** Server ids, once the turn is persisted. Absent while it is in flight. */
  questionMessageId?: string;
  answerMessageId?: string;
  operations: Operation[];
  specimens: Specimen[];
  status: "streaming" | "complete" | "aborted" | "failed";
  error?: string;
  /** Time to the first token, which is the number a reader actually feels. */
  firstTokenMs?: number;
  totalMs?: number;
};
