import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "./ratelimit";

describe("createRateLimiter", () => {
  it("allows everything when no Redis is configured, and says so", async () => {
    const limiter = createRateLimiter({});

    expect(limiter.configured).toBe(false);
    expect((await limiter.check("messages", "user-1")).ok).toBe(true);
  });

  it("allows a request under the limit", async () => {
    const redis = { eval: vi.fn(async () => [1]) };
    const limiter = createRateLimiter({ redis: redis as never });

    expect((await limiter.check("messages", "user-1")).ok).toBe(true);
  });

  it("refuses a request over the limit, with the delay attached", async () => {
    // One over the messages limit of 30 a minute.
    const redis = { eval: vi.fn(async () => [31]) };
    const limiter = createRateLimiter({ redis: redis as never });

    const result = await limiter.check("messages", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(429);
      expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("keeps the buckets separate, so uploading does not spend the message budget", async () => {
    const keys: string[] = [];
    const redis = {
      eval: vi.fn(async (_script: string, k: string[]) => {
        keys.push(k[0]);
        return [1];
      }),
    };
    const limiter = createRateLimiter({ redis: redis as never });

    await limiter.check("messages", "user-1");
    await limiter.check("uploads", "user-1");

    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toContain("messages");
    expect(keys[1]).toContain("uploads");
  });

  it("guards sign-in over a longer window than it guards spending", async () => {
    const windows: number[] = [];
    const redis = {
      eval: vi.fn(async (_script: string, _keys: string[], args: (string | number)[]) => {
        windows.push(Number(args[0]));
        return [1];
      }),
    };
    const limiter = createRateLimiter({ redis: redis as never });

    await limiter.check("messages", "user-1");
    await limiter.check("auth", "someone@example.com");

    expect(windows[1]).toBeGreaterThan(windows[0]);
  });

  it("allows the request when Redis itself fails, rather than locking everyone out", async () => {
    const redis = {
      eval: vi.fn(async () => {
        throw new Error("redis is down");
      }),
    };
    const limiter = createRateLimiter({ redis: redis as never });

    expect((await limiter.check("messages", "user-1")).ok).toBe(true);
  });
});
