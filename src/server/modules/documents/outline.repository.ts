import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { Outline } from "@/core/outline.types";
import type { Database } from "@/core/database.types";
import type { GrepMatch, OutlineRepository } from "./documents.types";

/**
 * What a document is made of, and literal search within it.
 *
 * Both read the columns ingestion wrote. Neither embeds anything: an outline is a
 * read, and a grep is a regex Postgres evaluates, which is what beats a dense
 * vector on an error code or a version string.
 */
export const createOutlineRepository = (db: SupabaseClient<Database>): OutlineRepository => ({
  async outline(documentId) {
    const { data, error } = await db
      .from("documents")
      .select("outline")
      .eq("id", documentId)
      .maybeSingle();

    if (error) return err(AppError.badGateway(`could not read the outline: ${error.message}`));
    if (!data) return err(AppError.notFound("no such document"));

    return ok((data.outline ?? null) as Outline | null);
  },

  async grep({ documentId, pattern, limit }) {
    const { data, error } = await db.rpc("grep_document", {
      p_document_id: documentId,
      p_pattern: pattern,
      p_limit: limit ?? 30,
    });

    // An invalid regex is the model's to fix, so the reason goes back as a bad
    // request rather than as a server fault.
    if (error) return err(AppError.badRequest(error.message));

    return ok(
      (data ?? []).map((row): GrepMatch => ({ lineNumber: row.line_number, line: row.line })),
    );
  },
});
