export interface StreamEvent {
  event: string;
  data: unknown;
}

export type FinishReason = "completed" | "aborted" | "failed";

export interface SseOptions {
  signal?: AbortSignal;
  /**
   * Called once, whatever happens. This is where persistence goes: an aborted
   * generation still has to store what it produced.
   */
  onFinish?: (reason: FinishReason, error?: unknown) => Promise<void> | void;
}

/** RFC 9457 problem document. Sent as `application/problem+json`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
}

/** A URL that passed validation, with the addresses the connection is pinned to. */
export interface CheckedUrl {
  url: URL;
  addresses: { address: string; family: number }[];
}
