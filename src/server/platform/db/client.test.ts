import { describe, expect, it } from "vitest";
import type { Database } from "@/core/database.types";

describe("generated database types", () => {
  it("exposes the tables the schema defines", () => {
    type Tables = keyof Database["public"]["Tables"];
    const expected: Tables[] = [
      "profiles",
      "documents",
      "document_chunks",
      "chats",
      "chat_documents",
      "messages",
      "message_parts",
      "user_memories",
      "ingestion_jobs",
    ];
    expect(expected).toHaveLength(9);
  });

  it("types a chunk embedding as the 1024-dimension vector column", () => {
    type Chunk = Database["public"]["Tables"]["document_chunks"]["Row"];
    const keys: (keyof Chunk)[] = ["id", "document_id", "chunk_index", "content", "embedding"];
    expect(keys).toContain("embedding");
  });

  it("exposes search_chunks as a callable function", () => {
    type Fns = keyof Database["public"]["Functions"];
    const fns: Fns[] = ["search_chunks", "get_chat_context", "append_message"];
    expect(fns).toContain("search_chunks");
  });
});
