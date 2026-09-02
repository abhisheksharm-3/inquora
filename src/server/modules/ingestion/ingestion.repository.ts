import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/core/database.types";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import { FILE_BATCH } from "./github.constants";
import type { ClaimedJob } from "./ingestion.types";

/**
 * The queue and the chunk store, as the worker sees them.
 *
 * Every claim, completion and failure is a database function, so the ordering
 * rules live next to the data rather than in whichever process happened to be
 * running. This client is the service role: the queue has RLS enabled with no
 * policy, because a user watches progress through documents.status, which they
 * own, and never touches the jobs themselves.
 */
export const createIngestionRepository = (db: SupabaseClient<Database>) => ({
  async claim(): Promise<Result<ClaimedJob | undefined, AppError>> {
    const { data, error } = await db.rpc("claim_ingestion_job");

    if (error) return err(AppError.badGateway(`claim_ingestion_job failed: ${error.message}`));

    const row = data?.[0];
    if (!row) return ok(undefined);

    return ok({ jobId: row.job_id, documentId: row.document_id, attempts: row.attempts });
  },

  async complete(jobId: number): Promise<Result<void, AppError>> {
    const { error } = await db.rpc("complete_ingestion_job", { p_job_id: jobId });

    if (error) return err(AppError.badGateway(`complete_ingestion_job failed: ${error.message}`));

    return ok(undefined);
  },

  async fail(jobId: number, reason: string): Promise<Result<void, AppError>> {
    const { error } = await db.rpc("fail_ingestion_job", { p_job_id: jobId, p_error: reason });

    if (error) return err(AppError.badGateway(`fail_ingestion_job failed: ${error.message}`));

    return ok(undefined);
  },

  /**
   * The highest chunk index already stored, so a retry resumes rather than
   * re-embedding what is already paid for.
   */
  async highWaterMark(documentId: string): Promise<Result<number, AppError>> {
    const { data, error } = await db
      .from("document_chunks")
      .select("chunk_index")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: false })
      .limit(1);

    if (error) return err(AppError.badGateway(`could not read progress: ${error.message}`));

    return ok(data?.[0]?.chunk_index ?? -1);
  },

  async setExpectedChunks(documentId: string, expected: number): Promise<Result<void, AppError>> {
    const { error } = await db
      .from("documents")
      .update({ expected_chunks: expected })
      .eq("id", documentId);

    if (error)
      return err(AppError.badGateway(`could not record the chunk total: ${error.message}`));

    return ok(undefined);
  },

  async setOutline(
    documentId: string,
    outline: unknown,
    text: string | undefined,
  ): Promise<Result<void, AppError>> {
    const { error } = await db
      .from("documents")
      .update({ outline: outline as never, extracted_text: text ?? null })
      .eq("id", documentId);

    if (error) return err(AppError.badGateway(`could not record the outline: ${error.message}`));

    return ok(undefined);
  },

  async insertFiles(
    documentId: string,
    files: { path: string; language: string; content: string; lineCount: number; bytes: number }[],
  ): Promise<Result<number, AppError>> {
    let written = 0;

    // Batched, because a repository is up to two thousand files and one statement
    // per file would be two thousand round trips.
    for (let start = 0; start < files.length; start += FILE_BATCH) {
      const batch = files.slice(start, start + FILE_BATCH);

      const { data, error } = await db.rpc("insert_document_files", {
        p_document_id: documentId,
        p_files: batch as never,
      });

      if (error) {
        return err(AppError.badGateway(`insert_document_files failed: ${error.message}`));
      }

      written += typeof data === "number" ? data : batch.length;
    }

    return ok(written);
  },

  async insertTable(
    documentId: string,
    table: { name: string; header: string[]; rows: Record<string, string>[] },
  ): Promise<Result<string, AppError>> {
    const { data, error } = await db.rpc("insert_document_table", {
      p_document_id: documentId,
      p_name: table.name,
      p_header: table.header,
      p_rows: table.rows as never,
    });

    if (error) {
      return err(AppError.badGateway(`insert_document_table failed: ${error.message}`));
    }

    return ok(data ?? "");
  },

  async insertChunks(
    documentId: string,
    chunks: { chunk_index: number; content: string; embedding: number[]; metadata: unknown }[],
  ): Promise<Result<number, AppError>> {
    const { data, error } = await db.rpc("insert_document_chunks", {
      p_document_id: documentId,
      p_chunks: chunks as never,
    });

    if (error) return err(AppError.badGateway(`insert_document_chunks failed: ${error.message}`));

    return ok(data ?? 0);
  },
});
