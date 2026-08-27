import { describe, expect, it } from "vitest";
import { createChatModel } from "./model";

describe("createChatModel", () => {
  it("reports a missing key rather than returning a model that cannot answer", async () => {
    const result = await createChatModel({});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("GEMINI_API_KEY");
  });

  it("builds the default provider", async () => {
    const result = await createChatModel({ apiKey: "test-key" });

    expect(result.ok).toBe(true);
  });

  it("rejects a model name with no provider, instead of guessing one", async () => {
    const result = await createChatModel({ apiKey: "test-key", model: "gemini-flash-latest" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("provider:model");
  });

  it("names the unconfigured provider rather than failing vaguely", async () => {
    const result = await createChatModel({ apiKey: "test-key", model: "openai:gpt-4o" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("openai");
  });
});
