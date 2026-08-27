/** RFC 9457 problem document. Sent as `application/problem+json`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
}

const TITLES: Record<number, string> = {
  404: "Not Found",
  409: "Conflict",
  429: "Too Many Requests",
  502: "Bad Gateway",
};

/**
 * An error that already knows its HTTP status. The transport layer serializes it
 * rather than translating a private error vocabulary into one.
 */
export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  private constructor(status: number, type: string, detail?: string, retryAfterSeconds?: number) {
    super(detail ?? TITLES[status] ?? "Error");
    this.name = "AppError";
    this.status = status;
    this.type = type;
    this.detail = detail;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static notFound = (detail?: string) => new AppError(404, "/errors/not-found", detail);
  static conflict = (detail?: string) => new AppError(409, "/errors/conflict", detail);
  static rateLimited = (retryAfterSeconds: number, detail?: string) =>
    new AppError(429, "/errors/rate-limited", detail, retryAfterSeconds);
  static badGateway = (detail?: string) => new AppError(502, "/errors/bad-gateway", detail);
}

export const toProblemDetails = (e: AppError, instance: string): ProblemDetails => ({
  type: e.type,
  title: TITLES[e.status] ?? "Error",
  status: e.status,
  ...(e.detail === undefined ? {} : { detail: e.detail }),
  instance,
});
