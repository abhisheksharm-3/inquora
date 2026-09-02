import { tool } from "langchain";
import { z } from "zod";
import type { AppError } from "@/core/errors";
import { evaluateArithmetic } from "@/core/arithmetic";
import type { Result } from "@/core/result";
import type { RetrievalRequest, RetrievedChunk } from "@/server/modules/retrieval/retrieval.schema";
import type { ChatContext } from "./chat.schema";

/** A passage as the model reads it: numbered, attributed, quotable. */
const renderChunks = (chunks: RetrievedChunk[], context: ChatContext): string =>
  chunks
    .map((chunk) => {
      const document = context.documents.find((d) => d.id === chunk.documentId);
      return `[${chunk.chunkIndex}] ${document?.title ?? chunk.documentId}\n${chunk.content}`;
    })
    .join("\n\n");

/**
 * The tools the answering agent is given.
 *
 * Retrieval is a tool rather than a fixed step, per ADR 0005, so the model can
 * search again with a better query, read around a hit when an answer straddles a
 * chunk boundary, or skip retrieval entirely when the question is about the
 * conversation. A fixed pipeline pays for retrieval either way and gains nothing
 * on that last case.
 *
 * A tool never throws. A failure is a sentence the model can act on, because a
 * thrown error inside the loop ends the turn with nothing to show.
 */
export const createTools = ({
  context,
  retrieval,
  chunks,
  memories,
  tables,
  structure,
  slices,
  onCitations,
}: ToolDependencies) => {
  const documentIds = context.documents.map((d) => d.id);

  const searchDocuments = tool(
    async ({ query, limit }: { query: string; limit?: number }) => {
      if (documentIds.length === 0) return "No documents are attached to this conversation.";

      const found = await retrieval.retrieve({ query, documentIds, limit: limit ?? 12 });

      if (!found.ok) {
        return found.error.status === 404
          ? `Nothing in the attached documents matched "${query}". Try different wording, or say the answer is not in these documents.`
          : `The search failed: ${found.error.detail ?? found.error.type}`;
      }

      onCitations(found.value.map((chunk) => chunk.chunkId));

      return renderChunks(found.value, context);
    },
    {
      name: "search_documents",
      description:
        "Search the documents attached to this conversation. Returns the passages that matched, " +
        "each numbered by its position in its document. Use this before answering anything about " +
        "document content.",
      schema: z.object({
        query: z.string().describe("What to look for, in the user's own terms."),
        limit: z.number().int().min(1).max(30).optional(),
      }),
    },
  );

  const readChunks = tool(
    async ({ document_id, from, to }: { document_id: string; from: number; to: number }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const found = await chunks.range({ documentId: document_id, from, to });

      if (!found.ok)
        return `Could not read those passages: ${found.error.detail ?? found.error.type}`;
      if (found.value.length === 0) return "There are no passages in that range.";

      onCitations(found.value.map((chunk) => chunk.chunkId));

      return renderChunks(found.value, context);
    },
    {
      name: "read_chunks",
      description:
        "Read consecutive passages from one document by position. Use this when a search hit looks " +
        "cut off, to read what comes either side of it.",
      schema: z.object({
        document_id: z.guid(),
        from: z.number().int().min(0),
        to: z.number().int().min(0),
      }),
    },
  );

  const listDocuments = tool(
    async () => {
      if (context.documents.length === 0) return "No documents are attached to this conversation.";

      return context.documents
        .map((d) => `${d.title} — ${d.kind}, ${d.status}, ${d.chunkCount} passages (id ${d.id})`)
        .join("\n");
    },
    {
      name: "list_documents",
      description:
        "List the documents attached to this conversation, with their kind, whether they are ready " +
        "to search, and how many passages each holds.",
      schema: z.object({}),
    },
  );

  const remember = tool(
    async ({ content }: { content: string }) => {
      const saved = await memories.remember(content);
      return saved.ok ? "Saved." : `Could not save that: ${saved.error.detail ?? saved.error.type}`;
    },
    {
      name: "remember",
      description:
        "Store a durable fact about the user, such as a preference or their role. Only for things " +
        "that should apply to future conversations.",
      schema: z.object({ content: z.string().min(1).max(500) }),
    },
  );

  const calculate = tool(
    async ({ expression }: { expression: string }) => {
      const value = evaluateArithmetic(expression);
      return value.ok ? String(value.value) : value.error;
    },
    {
      name: "calculate",
      description:
        "Evaluate an arithmetic expression exactly. Use this for any number that matters rather " +
        "than computing it in your head.",
      schema: z.object({ expression: z.string().min(1).max(200) }),
    },
  );

  const listTables = tool(
    async ({ document_id }: { document_id: string }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const found = await tables.list(document_id);

      if (!found.ok) return `Could not read the sheets: ${found.error.detail ?? found.error.type}`;
      if (found.value.length === 0) return "That document has no sheets to query.";

      return found.value
        .map((table) => `${table.name}: ${table.rowCount} rows, columns ${table.header.join(", ")}`)
        .join("\n");
    },
    {
      name: "list_tables",
      description:
        "List the sheets in a spreadsheet document, with their column names and row counts. Call " +
        "this before query_table so the query uses the real column names.",
      schema: z.object({ document_id: z.guid() }),
    },
  );

  const queryTable = tool(
    async ({
      document_id,
      table_name,
      sql,
    }: {
      document_id: string;
      table_name: string;
      sql: string;
    }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const rows = await tables.query({ documentId: document_id, tableName: table_name, sql });

      if (!rows.ok) {
        // The reason comes back verbatim so the model can correct the query
        // rather than guessing at what a generic failure meant.
        return `That query was refused: ${rows.error.detail ?? rows.error.type}`;
      }

      if (rows.value.length === 0) return "The query returned no rows.";

      return JSON.stringify(rows.value);
    },
    {
      name: "query_table",
      description:
        "Run one read-only SQL select over a spreadsheet. The sheet is a view named t with the " +
        'sheet\'s own column names, so quote them: select "Account" from t where "Value"::numeric > 100. ' +
        "Use this for any question about numbers, counts, totals or comparisons across rows, " +
        "because searching the text of a spreadsheet cannot answer those exactly.",
      schema: z.object({
        document_id: z.guid(),
        table_name: z.string().min(1),
        sql: z.string().min(1).max(2000),
      }),
    },
  );

  const getOutline = tool(
    async ({ document_id }: { document_id: string }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const found = await structure.outline(document_id);

      if (!found.ok) return `Could not read the outline: ${found.error.detail ?? found.error.type}`;
      if (!found.value) return "That document has no outline recorded.";

      return JSON.stringify(found.value);
    },
    {
      name: "get_outline",
      description:
        "What a document is made of: its headings, or its sheets and their columns. Reading this " +
        "before searching costs one call and tells you whether the document even covers what was " +
        "asked.",
      schema: z.object({ document_id: z.guid() }),
    },
  );

  const grepDocument = tool(
    async ({ document_id, pattern }: { document_id: string; pattern: string }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const found = await structure.grep({ documentId: document_id, pattern });

      if (!found.ok) return `That pattern was refused: ${found.error.detail ?? found.error.type}`;
      if (found.value.length === 0) return `Nothing in that document matches ${pattern}.`;

      return found.value.map((match) => `${match.lineNumber}: ${match.line}`).join("\n");
    },
    {
      name: "grep_document",
      description:
        "Find lines in a document matching a literal string or a regular expression, with their " +
        "line numbers. Use this for error codes, identifiers, version strings and exact phrases, " +
        "which a meaning-based search flattens and often misses.",
      schema: z.object({ document_id: z.guid(), pattern: z.string().min(1).max(200) }),
    },
  );

  const readFile = tool(
    async ({
      document_id,
      path,
      from_line,
      to_line,
    }: {
      document_id: string;
      path: string;
      from_line?: number;
      to_line?: number;
    }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const found = await slices.file({
        documentId: document_id,
        path,
        fromLine: from_line,
        toLine: to_line,
      });

      if (!found.ok) return `Could not read that file: ${found.error.detail ?? found.error.type}`;
      if (found.value.length === 0) {
        return `No file at ${path} in that repository. Use get_outline to see the file tree.`;
      }

      return found.value
        .map((slice) => `${path}:${slice.fromLine}-${slice.toLine}\n${slice.content}`)
        .join("\n\n");
    },
    {
      name: "read_file",
      description:
        "Read a file from a repository document by path, optionally a line range. Use get_outline " +
        "first to see which files exist.",
      schema: z.object({
        document_id: z.guid(),
        path: z.string().min(1).max(400),
        from_line: z.number().int().min(1).optional(),
        to_line: z.number().int().min(1).optional(),
      }),
    },
  );

  const getTranscript = tool(
    async ({
      document_id,
      start_s,
      end_s,
    }: {
      document_id: string;
      start_s?: number;
      end_s?: number;
    }) => {
      if (!documentIds.includes(document_id)) {
        return "That document is not attached to this conversation.";
      }

      const found = await slices.transcript({
        documentId: document_id,
        startSeconds: start_s,
        endSeconds: end_s,
      });

      if (!found.ok)
        return `Could not read that segment: ${found.error.detail ?? found.error.type}`;
      if (found.value.length === 0) return "Nothing was said in that part of the video.";

      // The timestamps are what make a citation a deep link rather than a
      // reference to the whole video.
      return found.value
        .map((segment) => `[${segment.startSeconds}s-${segment.endSeconds}s] ${segment.content}`)
        .join("\n\n");
    },
    {
      name: "get_transcript",
      description:
        "Read what was said in a video between two times, in seconds, with timestamps so an " +
        "answer can point at the moment.",
      schema: z.object({
        document_id: z.guid(),
        start_s: z.number().int().min(0).optional(),
        end_s: z.number().int().min(0).optional(),
      }),
    },
  );

  return [
    searchDocuments,
    readChunks,
    listDocuments,
    getOutline,
    grepDocument,
    listTables,
    queryTable,
    readFile,
    getTranscript,
    remember,
    calculate,
  ];
};
import type { ToolDependencies } from "./chat.types";
