import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Database } from "@/core/database.types";
import type { DocumentTable, TablesRepository } from "./documents.types";

/**
 * The sheets of a document, and read-only SQL over one of them.
 *
 * The query runs inside `query_document_table`, which fences it: one select, no
 * semicolon, a keyword deny list, a view holding only this document's rows, a
 * statement timeout and a row cap. Nothing is validated a second time here,
 * because a second copy of a security rule is a second place for it to drift.
 */
export const createTablesRepository = (db: SupabaseClient<Database>): TablesRepository => ({
  async list(documentId) {
    const { data, error } = await db
      .from("document_tables")
      .select("name, header, row_count")
      .eq("document_id", documentId)
      .order("name");

    if (error) return err(AppError.badGateway(`could not list the sheets: ${error.message}`));

    return ok(
      (data ?? []).map((row): DocumentTable => ({
        name: row.name,
        header: row.header,
        rowCount: row.row_count,
      })),
    );
  },

  async query({ documentId, tableName, sql, limit }) {
    const { data, error } = await db.rpc("query_document_table", {
      p_document_id: documentId,
      p_table_name: tableName,
      p_sql: sql,
      p_limit: limit ?? 200,
    });

    // A rejected query is the model's problem to fix, not a server fault, so the
    // reason travels back as something it can read and retry against.
    if (error) return err(AppError.badRequest(error.message));

    return ok((data ?? []) as Record<string, unknown>[]);
  },
});
