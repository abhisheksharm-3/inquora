import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import type { Database } from "@/core/database.types";
import { fetchExternal } from "@/server/platform/http/fetch-external";
import { outlineFromSheets, outlineFromText } from "@/core/documents/outline";
import { chunkSource } from "./extract";
import { extractRepository, parseRepositoryUrl } from "./extract-github";
import { extractSlides } from "./extract-slides";
import type { ClaimedJob, ExtractedDocument, Source } from "./ingestion.types";
import { STORAGE_BUCKET } from "@/server/modules/documents/documents.constants";

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
): Promise<Result<ExtractedDocument, AppError>> => {
  const { data: document, error } = await db
    .from("documents")
    .select("kind, title, storage_path, source_url")
    .eq("id", job.documentId)
    .single();

  if (error) return err(AppError.badGateway(`could not read the document row: ${error.message}`));

  const source = await readSource(db, document);
  if (!source.ok) return err(source.error);

  const chunks = chunkSource(source.value);
  if (!chunks.ok) return err(chunks.error);

  // A workbook is stored twice on purpose: as chunks, so a question about it can
  // be found by meaning, and as rows, so a question about its numbers can be
  // answered by arithmetic.
  const tables = (source.value.sheets ?? []).map((sheet) => ({
    name: sheet.name,
    header: sheet.header,
    rows: sheet.rows.map((row) =>
      Object.fromEntries(sheet.header.map((column, index) => [column, row[index] ?? ""])),
    ),
  }));

  const outline =
    source.value.outline ??
    (source.value.sheets && source.value.sheets.length > 0
      ? outlineFromSheets(source.value.sheets)
      : outlineFromText(source.value.text ?? ""));

  return ok({
    chunks: chunks.value,
    expectedChunks: chunks.value.length,
    tables,
    outline,
    // Only prose keeps its text. A workbook's rows are the queryable form of it,
    // and storing a flattened copy would be the mistake the old extractor made.
    text: source.value.sheets || source.value.files ? undefined : source.value.text,
    files: source.value.files,
  });
};

type DocumentRow = {
  kind: Source["kind"];
  storage_path: string | null;
  source_url: string | null;
};

const readSource = async (
  db: SupabaseClient<Database>,
  document: DocumentRow,
): Promise<Result<Source, AppError>> => {
  // A video is a URL to a service that already has the transcript, so it never
  // touches storage. The seven packages that used to do this locally, one of them
  // spawning a binary from node_modules, are gone.
  if (document.kind === "video") {
    if (!document.source_url) return err(AppError.badRequest("a video needs a URL"));
    return readTranscript(document.source_url);
  }

  // A repository is a URL to fetch, not a file in storage.
  if (document.kind === "github") {
    if (!document.source_url) return err(AppError.badRequest("a repository needs a URL"));

    const repository = parseRepositoryUrl(document.source_url);
    if (!repository.ok) return err(repository.error);

    const { env } = await import("@/server/platform/env");
    const read = await extractRepository(repository.value, env().GITHUB_TOKEN);
    if (!read.ok) return err(read.error);

    // No retained text: the files are the text now, each greppable on its own
    // and readable by real line number rather than by the chunk that overlapped.
    return ok({
      kind: "github",
      chunks: read.value.chunks,
      outline: read.value.outline,
      files: read.value.files,
    });
  }

  if (document.source_url) {
    // Through fetchExternal, never plain fetch: the URL came from whoever created
    // the document, and this code runs with a service-role client inside the
    // deployment's network.
    const fetched = await fetchExternal(document.source_url);
    if (!fetched.ok) return err(fetched.error);

    return ok({ kind: document.kind, text: stripMarkup(fetched.value.text) });
  }

  if (!document.storage_path) {
    return err(AppError.badRequest("the document has neither a file nor a URL"));
  }

  const { data, error } = await db.storage.from(STORAGE_BUCKET).download(document.storage_path);

  if (error) return err(AppError.badGateway(`could not download the file: ${error.message}`));

  const bytes = new Uint8Array(await data.arrayBuffer());

  switch (document.kind) {
    case "pdf":
      return readPdf(bytes);
    case "sheet":
      return readSheet(bytes);
    case "doc":
      return readDoc(bytes, await data.text());
    case "slides": {
      const read = await extractSlides(bytes);
      if (!read.ok) return err(read.error);

      return ok({ kind: "slides", slides: read.value.slides });
    }
    case "image":
      return readImage(bytes, data.type);
    default:
      // Plain text needs no parser.
      return ok({ kind: document.kind, text: await data.text() });
  }
};

/**
 * Every parser is imported where it is used rather than at module load. A route
 * that answers a question should not pull a spreadsheet reader into its bundle.
 */
const readPdf = async (bytes: Uint8Array): Promise<Result<Source, AppError>> => {
  try {
    // unpdf rather than pdf-parse: pdf-parse 1.x is seven years old and reads a
    // test PDF off the filesystem when module.parent is undefined, which is a
    // bundled serverless function's normal state. unpdf carries a serverless
    // build of pdf.js and touches no filesystem.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });

    return ok({ kind: "pdf", text: Array.isArray(text) ? text.join("\n\n") : text });
  } catch (cause) {
    return err(
      AppError.badRequest(
        `that file could not be read as a PDF: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
};

/**
 * A workbook becomes real rows, not a flattened blob of text. The old extractor
 * wrote `=== Sheet: name ===` and embedded it, which destroys columns, types and
 * row identity, and is why spreadsheet questions failed.
 */
const readSheet = async (bytes: Uint8Array): Promise<Result<Source, AppError>> => {
  try {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);

    const sheets = workbook.worksheets.map((worksheet) => {
      const rows: string[][] = [];
      let header: string[] = [];

      worksheet.eachRow((row, index) => {
        const values = (row.values as unknown[]).slice(1).map((cell) => cellToText(cell));

        if (index === 1) header = values;
        else rows.push(values);
      });

      return { name: worksheet.name, header, rows };
    });

    return ok({ kind: "sheet", sheets: sheets.filter((sheet) => sheet.rows.length > 0) });
  } catch (cause) {
    return err(
      AppError.badRequest(
        `that file could not be read as a spreadsheet: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
};

/** A cell keeps its own text. A formula keeps its result, which is what a reader sees. */
const cellToText = (cell: unknown): string => {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object" && "result" in cell)
    return String((cell as { result: unknown }).result ?? "");
  if (typeof cell === "object" && "text" in cell)
    return String((cell as { text: unknown }).text ?? "");
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);

  return String(cell);
};

const readDoc = async (bytes: Uint8Array, fallback: string): Promise<Result<Source, AppError>> => {
  // A .docx is a zip; anything else with kind `doc` is already text.
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;

  if (!isZip) return ok({ kind: "doc", text: fallback });

  try {
    const mammoth = await import("mammoth");
    // extractRawText rather than convertToHtml: the text is going to a chunker
    // and an embedding model, and markup would be embedded as content.
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });

    return ok({ kind: "doc", text: value });
  } catch (cause) {
    return err(
      AppError.badRequest(
        `that document could not be read: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
};

/**
 * An image has no text to extract, so it is described instead.
 *
 * This is the one place ingestion spends a model call. The alternative is an
 * image nobody can find: a filename is not content, and there is no OCR in this
 * stack. The description is what gets embedded, so the image is searchable by
 * what is in it.
 */
const readImage = async (
  bytes: Uint8Array,
  mimeType: string,
): Promise<Result<Source, AppError>> => {
  const { env } = await import("@/server/platform/env");
  const { createChatModel } = await import("@/server/platform/llm/model");
  const configuration = env();

  const model = await createChatModel({
    apiKey: configuration.GEMINI_API_KEY,
    model: configuration.ANSWER_MODEL,
  });

  if (!model.ok) return err(model.error);

  try {
    const described = await model.value.invoke([
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Describe this image so it can be found by someone searching for what it contains. " +
              "Transcribe any text in it verbatim. Say what kind of image it is — a chart, a " +
              "screenshot, a photograph, a diagram — and for a chart, state what it plots and the " +
              "values you can read.",
          },
          {
            type: "image_url",
            image_url: `data:${mimeType || "image/png"};base64,${Buffer.from(bytes).toString("base64")}`,
          },
        ],
      },
    ]);

    const text = typeof described.content === "string" ? described.content : "";

    if (text.trim().length === 0) {
      return err(AppError.badRequest("the image could not be described"));
    }

    return ok({ kind: "image", text });
  } catch (cause) {
    return err(
      AppError.badGateway(
        `could not describe the image: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
};

/**
 * Subtitles if the video has them, a transcription if it does not. Both come from
 * the Space that is already serving them.
 */
const readTranscript = async (url: string): Promise<Result<Source, AppError>> => {
  const { env } = await import("@/server/platform/env");
  const configuration = env();

  if (!configuration.MULTIUTILITY_API_KEY) {
    return err(
      AppError.misconfigured("MULTIUTILITY_API_KEY is not set, so no subtitles can be read"),
    );
  }

  // The Space does the fetching, so this is not our network being probed, but a
  // URL that is not https has no business being passed on either.
  if (!url.startsWith("https://")) {
    return err(AppError.badRequest("a video URL must be https"));
  }

  try {
    const response = await fetch(`${configuration.EMBEDDINGS_BASE_URL}/api/v1/subtitles/extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": configuration.MULTIUTILITY_API_KEY,
      },
      body: JSON.stringify({ url, lang: "en" }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      return err(AppError.badGateway(`the subtitle service returned ${response.status}`));
    }

    const body = (await response.json()) as {
      subtitles?: (string | { text?: string; start?: number; duration?: number })[];
    };

    const lines = body.subtitles ?? [];

    if (lines.length === 0) {
      return err(AppError.badRequest("that video has no subtitles"));
    }

    // The endpoint returns either plain strings or objects carrying a start
    // time. A real start is used when it is there; otherwise the time is
    // interpolated across the lines, which is honest about being an estimate and
    // still puts a citation within seconds of the moment.
    const timed = lines.every(
      (line) => typeof line === "object" && line !== null && typeof line.start === "number",
    );

    if (timed) {
      return ok({
        kind: "video",
        transcript: (lines as { text?: string; start: number }[]).map((line) => ({
          start: Math.round(line.start),
          text: (line.text ?? "").trim(),
        })),
      });
    }

    const texts = lines.map((line) => (typeof line === "string" ? line : String(line.text ?? "")));

    // Roughly three words a second is normal speech, which is a better estimate
    // than treating every line as equally long.
    const WORDS_PER_SECOND = 3;
    let elapsed = 0;

    return ok({
      kind: "video",
      transcript: texts.map((text) => {
        const start = Math.round(elapsed);
        elapsed += Math.max(text.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND, 1);

        return { start, text };
      }),
    });
  } catch (cause) {
    return err(
      AppError.badGateway(
        `could not read subtitles: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
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
