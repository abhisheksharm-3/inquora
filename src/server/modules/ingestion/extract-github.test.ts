import { describe, expect, it } from "vitest";
import { parseRepositoryUrl } from "./extract-github";

describe("parseRepositoryUrl", () => {
  it("reads owner and name", () => {
    const result = parseRepositoryUrl("https://github.com/supabase/supabase");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ owner: "supabase", name: "supabase" });
  });

  it("tolerates a .git suffix", () => {
    const result = parseRepositoryUrl("https://github.com/owner/name.git");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("name");
  });

  it("reads a branch from a tree URL", () => {
    const result = parseRepositoryUrl("https://github.com/owner/name/tree/develop");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ref).toBe("develop");
  });

  it("refuses a host that is not github.com", () => {
    // Not an arbitrary restriction: the zipball path and the auth header are
    // GitHub's, and pretending otherwise would fetch something unrelated.
    const result = parseRepositoryUrl("https://gitlab.com/owner/name");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("github.com");
  });

  it("refuses a URL that names no repository", () => {
    expect(parseRepositoryUrl("https://github.com/owner").ok).toBe(false);
  });

  it("refuses something that is not a URL", () => {
    expect(parseRepositoryUrl("supabase/supabase").ok).toBe(false);
  });
});
