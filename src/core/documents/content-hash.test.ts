import { describe, expect, it } from "vitest";
import { contentHash } from "./content-hash";

describe("contentHash", () => {
  it("is stable for the same bytes", async () => {
    const bytes = new TextEncoder().encode("the same document");
    expect(await contentHash(bytes)).toBe(await contentHash(bytes));
  });

  it("differs for different bytes", async () => {
    expect(await contentHash(new TextEncoder().encode("a"))).not.toBe(
      await contentHash(new TextEncoder().encode("b")),
    );
  });

  it("is hex, so it fits a text column and a URL", async () => {
    expect(await contentHash(new TextEncoder().encode("x"))).toMatch(/^[0-9a-f]{64}$/);
  });
});
