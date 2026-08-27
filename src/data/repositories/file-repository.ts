/**
 * File repository for database operations.
 * Provides a clean abstraction layer over Supabase for file-related queries.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { TypeFile, TypeDatabase } from "@/types/database";

export type FileRepository = ReturnType<typeof createFileRepository>;

export function createFileRepository(supabase: SupabaseClient<TypeDatabase>) {
  return {
    /**
     * Fetches all files for a user.
     */
    async findAllByUserId(userId: string): Promise<TypeFile[]> {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as TypeFile[];
    },

    /**
     * Fetches a single file by ID.
     */
    async findById(fileId: string): Promise<TypeFile | null> {
      const { data, error } = await supabase.from("files").select("*").eq("id", fileId).single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as TypeFile;
    },

    /**
     * Creates a new file record.
     */
    async create(file: Omit<TypeFile, "id" | "uploaded_at">): Promise<TypeFile> {
      const { data, error } = await supabase.from("files").insert(file).select().single();

      if (error) throw error;
      return data;
    },

    /**
     * Updates an existing file record.
     */
    async update(fileId: string, updates: Partial<TypeFile>): Promise<TypeFile> {
      const { data, error } = await supabase
        .from("files")
        .update(updates)
        .eq("id", fileId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Updates file processing status.
     */
    async updateStatus(
      fileId: string,
      processingStatus: "idle" | "processing" | "completed" | "failed",
    ): Promise<void> {
      const { error } = await supabase
        .from("files")
        .update({ processing_status: processingStatus })
        .eq("id", fileId);

      if (error) throw error;
    },

    /**
     * Deletes a file record by ID.
     */
    async delete(fileId: string): Promise<void> {
      const { error } = await supabase.from("files").delete().eq("id", fileId);

      if (error) throw error;
    },
  };
}
