import { describe, expect, it } from "vitest";
import { fetchExternal } from "./fetch-external";

/**
 * These exercise the refusals, which is the part that matters. The happy path
 * needs a network and is covered by the live ingestion run.
 */
describe("fetchExternal", () => {
  it("refuses a URL that is not https", async () => {
    const result = await fetchExternal("http://example.com/doc.txt");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("https");
  });

  it("refuses a file URL", async () => {
    const result = await fetchExternal("file:///etc/passwd");

    expect(result.ok).toBe(false);
  });

  it("refuses credentials embedded in the URL", async () => {
    const result = await fetchExternal("https://user:secret@example.com/doc.txt");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("credentials");
  });

  it("refuses loopback by name", async () => {
    const result = await fetchExternal("https://localhost/admin");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("not public");
  });

  it("refuses the cloud metadata address", async () => {
    const result = await fetchExternal("https://169.254.169.254/latest/meta-data/");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("not public");
  });

  it("refuses a private address given directly", async () => {
    for (const host of ["10.0.0.1", "192.168.1.1", "127.0.0.1", "[::1]"]) {
      const result = await fetchExternal(`https://${host}/x`);
      expect(result.ok).toBe(false);
    }
  });

  it("refuses something that is not a URL at all", async () => {
    const result = await fetchExternal("not a url");

    expect(result.ok).toBe(false);
  });
});
