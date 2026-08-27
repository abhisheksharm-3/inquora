import { describe, expect, it } from "vitest";
import { AppError, toProblemDetails } from "./errors";

describe("AppError", () => {
  it("carries the HTTP status for a missing resource", () => {
    const e = AppError.notFound("no chunk matched the query");
    expect(e.status).toBe(404);
    expect(e.detail).toBe("no chunk matched the query");
  });

  it("carries a conflict for a document that is still processing", () => {
    expect(AppError.conflict("3 of 41 chunks indexed").status).toBe(409);
  });

  it("records the retry delay for a rate limit", () => {
    const e = AppError.rateLimited(30);
    expect(e.status).toBe(429);
    expect(e.retryAfterSeconds).toBe(30);
  });

  it("reports an upstream provider failure as a bad gateway", () => {
    expect(AppError.badGateway().status).toBe(502);
  });

  it("serializes to an RFC 9457 problem document", () => {
    const e = AppError.conflict("still processing");
    expect(toProblemDetails(e, "/api/chats/abc/messages")).toEqual({
      type: "/errors/conflict",
      title: "Conflict",
      status: 409,
      detail: "still processing",
      instance: "/api/chats/abc/messages",
    });
  });
});
