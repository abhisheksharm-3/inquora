import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NODE_ENV: "test",
};

describe("parseEnv", () => {
  it("accepts an environment with only the required keys", () => {
    const result = parseEnv(complete);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("names the missing key rather than failing generically", () => {
    const result = parseEnv({ ...complete, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("rejects a Supabase URL that is not a URL", () => {
    const result = parseEnv({ ...complete, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("leaves an absent optional provider undefined instead of throwing", () => {
    const result = parseEnv(complete);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.UPSTASH_REDIS_REST_URL).toBeUndefined();
      expect(result.value.GEMINI_API_KEY).toBeUndefined();
    }
  });

  it("defaults the embeddings base URL to the Space rather than requiring it", () => {
    const result = parseEnv(complete);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.EMBEDDINGS_BASE_URL).toBe(
        "https://abhisheksan-multiutility-server.hf.space",
      );
    }
  });

  it("treats a half-configured Redis as a configuration error", () => {
    const result = parseEnv({ ...complete, UPSTASH_REDIS_REST_URL: "https://redis.example.com" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("UPSTASH_REDIS_REST_TOKEN");
  });
});
