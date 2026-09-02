import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { MemoryRepository } from "./memory.types";

/**
 * Durable facts about the user.
 *
 * The user id is read from the session and passed explicitly. The first version
 * passed `undefined` on the theory that row-level security would supply it, which
 * is a misreading of what RLS does: it filters and it checks, it does not fill in
 * a value. `user_memories.user_id` is not null with no default, so every call to
 * the `remember` tool failed.
 */
export const createMemoryRepository = (db: SupabaseClient<Database>): MemoryRepository => ({
  async remember(content) {
    const { data: identity } = await db.auth.getUser();

    if (!identity.user) return err(AppError.unauthorized("no session to remember against"));

    const { data, error } = await db
      .from("user_memories")
      .insert({ content, user_id: identity.user.id })
      .select("id")
      .single();

    if (error) return err(AppError.badGateway(`could not store the memory: ${error.message}`));

    return ok(data.id);
  },
});
