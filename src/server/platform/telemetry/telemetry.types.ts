/** What a span records. Flat on purpose: an attribute set, not a nested object. */
export type SpanAttributes = Record<string, string | number | boolean | undefined>;

export interface SpanHandle {
  /** Add attributes discovered while the work ran, such as a token count. */
  set(attributes: SpanAttributes): void;
  /** Mark the span failed and record why. */
  fail(error: unknown): void;
  end(): void;
}

/** Named so the trace reads as the pipeline rather than as a list of functions. */
export type SpanName =
  | "answer"
  | "resolve_question"
  | "retrieval"
  | "embedding"
  | "generation"
  | "tool"
  | "ingestion"
  | "extraction";
