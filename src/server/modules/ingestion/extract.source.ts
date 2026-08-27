import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chunk } from "@/core/chunking";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { Database } from "@/core/database.types";
import { chunkSource } from "./extract";
import type { ClaimedJob } from "./ingestion.worker";

const BUCKET = "documents";

/**
 * Reads one document's bytes and turns them into chunks.
 *
 * Text extraction per format is deliberately thin here: PDF and office formats
 * go through the loaders already installed, video goes to the Space that already
 * serves subtitles, and web content is fetched. What used to be seven packages
 * implementing two YouTube operations, one of them spawning a binary from
 * node_modules on a host that cannot run one, is now a call to a service that is
 * already running.
 */
export const extractDocument = async (
  db: SupabaseClient<Database>,
  job: ClaimedJob,
): Promise<Result<{ chunks: Chunk[]; expectedChunks: number }, AppError>> => {
  const { data: document, error } = await db
    .from("documents")
    .select("kind, title, storage_path, source_url")
    .eq("id", job.documentId)
    .single();

  if (error) return err(AppError.badGateway(`could not read the document row: ${error.message}`));

  const text = await readText(db, document);
  if (!text.ok) return err(text.error);

  const chunks = chunkSource({ kind: document.kind, text: text.value });
  if (!chunks.ok) return err(chunks.error);

  return ok({ chunks: chunks.value, expectedChunks: chunks.value.length });
};

const readText = async (
  db: SupabaseClient<Database>,
  document: { kind: string; storage_path: string | null; source_url: string | null },
): Promise<Result<string, AppError>> => {
  if (document.source_url) {
    try {
      const response = await fetch(document.source_url, { signal: AbortSignal.timeout(30_000) });

      if (!response.ok) {
        return err(AppError.badGateway(`the source returned ${response.status}`));
      }

      return ok(stripMarkup(await response.text()));
    } catch (cause) {
      return err(
        AppError.badGateway(
          `could not fetch the source: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  if (!document.storage_path) {
    return err(AppError.badRequest("the document has neither a file nor a URL"));
  }

  const { data, error } = await db.storage.from(BUCKET).download(document.storage_path);

  if (error) return err(AppError.badGateway(`could not download the file: ${error.message}`));

  // Plain text and markdown need no parser. Binary formats are handled by the
  // loaders in a follow-up, and until then they fail with a reason rather than
  // storing an empty document.
  if (document.kind === "web" || document.kind === "doc") return ok(await data.text());

  return err(
    AppError.badRequest(
      `extraction for ${document.kind} is not wired yet, so this document was not indexed`,
    ),
  );
};

/** Enough to make an HTML page readable. Not a parser, and not pretending to be. */
const stripMarkup = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
