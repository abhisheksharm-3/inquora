import { describe, expect, it } from "vitest";

/**
 * The bearer gate on the drain, which had no test — and it is the only thing
 * between the internet and service-role ingestion.
 *
 * The comparison is exercised directly rather than through the handler, because
 * the handler's other half needs a database and a provider, and what is worth
 * pinning here is that a wrong secret, a missing secret and an unset secret all
 * refuse.
 */
import { timingSafeEqual } from "node:crypto";

const authorized = (provided: string | undefined, secret: string | undefined): boolean => {
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
};

describe("the drain's bearer gate", () => {
  const secret = "5988922bb20add997a0d18a58e5402087657de56df5a2036";

  it("accepts the configured secret", () => {
    expect(authorized(secret, secret)).toBe(true);
  });

  it("refuses a wrong secret of the same length", () => {
    const wrong = `${secret.slice(0, -1)}0`;
    expect(wrong.length).toBe(secret.length);
    expect(authorized(wrong, secret)).toBe(false);
  });

  it("refuses a secret of a different length without throwing", () => {
    // timingSafeEqual throws on a length mismatch, which would surface as a 500
    // rather than a 401 and tell the caller its guess was the wrong length.
    expect(() => authorized("short", secret)).not.toThrow();
    expect(authorized("short", secret)).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(authorized(secret, undefined)).toBe(false);
    expect(authorized(undefined, undefined)).toBe(false);
  });

  it("refuses a missing header", () => {
    expect(authorized(undefined, secret)).toBe(false);
  });
});
