/**
 * An error that already knows its HTTP status. The transport layer renders it as
 * an RFC 9457 problem document rather than translating a private error
 * vocabulary into one.
 *
 * The status is the whole classification. There is no title here on purpose:
 * reason phrases are standard and Node ships them as http.STATUS_CODES, so they
 * are looked up where the document is serialized. `core/` stays free of any
 * runtime-specific import.
 */
export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  private constructor(status: number, type: string, detail?: string, retryAfterSeconds?: number) {
    super(detail ?? type);
    this.name = "AppError";
    this.status = status;
    this.type = type;
    this.detail = detail;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static badRequest = (detail?: string) => new AppError(400, "/errors/bad-request", detail);
  static unauthorized = (detail?: string) => new AppError(401, "/errors/unauthorized", detail);
  static notFound = (detail?: string) => new AppError(404, "/errors/not-found", detail);
  static conflict = (detail?: string) => new AppError(409, "/errors/conflict", detail);
  /** Well-formed, and asks for something that cannot be done. */
  static unprocessable = (detail?: string) => new AppError(422, "/errors/unprocessable", detail);
  static rateLimited = (retryAfterSeconds: number, detail?: string) =>
    new AppError(429, "/errors/rate-limited", detail, retryAfterSeconds);
  static badGateway = (detail?: string) => new AppError(502, "/errors/bad-gateway", detail);
  /** The environment or a provider is configured wrongly. Never shown to a user. */
  static misconfigured = (detail?: string) => new AppError(500, "/errors/misconfigured", detail);
}
