import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { MemoryRepository } from "./memory.types";

/**
 * Durable facts about the user. RLS scopes the table to its owner, so the insert
 * carries no user id: the old `user_memories.user_id` had no foreign key at all,
 * and nothing stopped a row naming a user who did not exist.
 */
export const createMemoryRepository = (db: SupabaseClient<Database>): MemoryRepository => ({
  async remember(content) {
    const { data, error } = await db
      .from("user_memories")
      .insert({ content, user_id: undefined as unknown as string })
      .select("id")
      .single();

    if (error) return err(AppError.badGateway(`could not store the memory: ${error.message}`));

    return ok(data.id);
  },
});
