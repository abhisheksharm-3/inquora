import { describe, expect, it } from "vitest";
import { AppError } from "@/core/errors";
import { problemResponse, toProblemDetails } from "./problem";

describe("toProblemDetails", () => {
  it("serializes to an RFC 9457 problem document", () => {
    expect(
      toProblemDetails(AppError.conflict("still processing"), "/api/chats/abc/messages"),
    ).toEqual({
      type: "/errors/conflict",
      title: "Conflict",
      status: 409,
      detail: "still processing",
      instance: "/api/chats/abc/messages",
    });
  });

  it("takes the title from Node's status codes rather than a local table", () => {
    expect(toProblemDetails(AppError.rateLimited(30), "/x").title).toBe("Too Many Requests");
    expect(toProblemDetails(AppError.badGateway(), "/x").title).toBe("Bad Gateway");
  });

  it("omits detail when there is none, rather than sending null", () => {
    expect(toProblemDetails(AppError.notFound(), "/x")).not.toHaveProperty("detail");
  });
});

describe("problemResponse", () => {
  it("uses the problem+json content type", async () => {
    const response = problemResponse(AppError.notFound("nothing matched"), "/x");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ status: 404, detail: "nothing matched" });
  });

  it("sets Retry-After from the error, so a client does not have to guess", () => {
    const response = problemResponse(AppError.rateLimited(30), "/x");
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("sets no Retry-After when the error carries none", () => {
    expect(problemResponse(AppError.conflict(), "/x").headers.get("retry-after")).toBeNull();
  });
});
