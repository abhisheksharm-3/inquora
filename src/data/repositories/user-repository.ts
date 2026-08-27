/**
 * User repository for database operations.
 * Provides a clean abstraction layer over Supabase for user-related queries.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { TypeUser, TypeDatabase } from "@/types/database";

export type UserRepository = ReturnType<typeof createUserRepository>;

export function createUserRepository(supabase: SupabaseClient<TypeDatabase>) {
  return {
    /**
     * Fetches a user by ID.
     */
    async findById(userId: string): Promise<TypeUser | null> {
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as TypeUser;
    },

    /**
     * Fetches a user by email.
     */
    async findByEmail(email: string): Promise<TypeUser | null> {
      const { data, error } = await supabase.from("users").select("*").eq("email", email).single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as TypeUser;
    },

    /**
     * Creates a new user.
     */
    async create(user: Omit<TypeUser, "created_at" | "updated_at">): Promise<TypeUser> {
      const { data, error } = await supabase.from("users").insert(user).select().single();

      if (error) throw error;
      return data;
    },

    /**
     * Updates an existing user.
     */
    async update(userId: string, updates: Partial<TypeUser>): Promise<TypeUser> {
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Checks if a user exists by ID.
     */
    async exists(userId: string): Promise<boolean> {
      const { count, error } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("id", userId);

      if (error) throw error;
      return (count ?? 0) > 0;
    },
  };
}
