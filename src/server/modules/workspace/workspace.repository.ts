import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/core/database.types";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type {
  AccountUsage,
  ChatDetail,
  ChatEntry,
  DocumentEntry,
  Message,
} from "@/core/workspace/workspace.types";
import type { WorkspaceRepository } from "./workspace.types";

/**
 * What the signed-in surfaces read and write: the register of documents, the
 * list of conversations, and which documents a conversation searches.
 *
 * Every call runs as the signed-in person, so authorization is row-level
 * security rather than a filter written here. A `user_id = ...` clause in this
 * file would be a second, weaker copy of a rule the database already holds, and
 * the one that drifts.
 */
export const createWorkspaceRepository = (db: SupabaseClient<Database>): WorkspaceRepository => ({
  async listDocuments() {
    const { data, error } = await db
      .from("documents")
      .select(
        "id, title, kind, status, byte_size, chunk_count, expected_chunks, error, created_at, indexed_at",
      )
      .order("created_at", { ascending: false });

    if (error) return err(AppError.badGateway(`could not list documents: ${error.message}`));

    return ok(data.map(toDocumentEntry));
  },

  async listChats() {
    // One query with embedded rows rather than a query per chat: the old history
    // page issued one read per conversation to find out what it was about.
    const { data, error } = await db
      .from("chats")
      .select(
        `id, title, updated_at, web_search,
         chat_documents(enabled, documents(id, title)),
         messages(count)`,
      )
      .order("updated_at", { ascending: false });

    if (error) return err(AppError.badGateway(`could not list conversations: ${error.message}`));

    return ok(
      data.map(
        (row): ChatEntry => ({
          id: row.id,
          title: row.title,
          updatedAt: row.updated_at,
          webSearch: row.web_search,
          documents: row.chat_documents
            .filter((link) => link.documents !== null)
            .map((link) => ({
              id: link.documents.id,
              title: link.documents.title,
              enabled: link.enabled,
            })),
          messageCount: row.messages[0]?.count ?? 0,
        }),
      ),
    );
  },

  async chat(chatId) {
    const { data, error } = await db
      .from("chats")
      .select(
        `id, title, web_search,
         chat_documents(enabled, position, documents(id, title, kind, status, byte_size, chunk_count, expected_chunks, error, created_at, indexed_at)),
         messages(id, role, parent_id, created_at, latency_ms, retrieval_ms, model,
                  message_parts(id, kind, text, chunk_id, tool_name, tool_args, tool_result, position,
                                document_chunks(id, document_id, chunk_index, content, documents(title))))`,
      )
      .eq("id", chatId)
      .maybeSingle();

    if (error) return err(AppError.badGateway(`could not read the conversation: ${error.message}`));
    if (!data) return ok(null);

    const links = [...data.chat_documents].sort((a, b) => a.position - b.position);

    // Ordered here rather than in the query because PostgREST cannot order an
    // embedded resource nested two levels deep.
    const messages: Message[] = [...data.messages]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((message) => ({
        id: message.id,
        role: message.role,
        parentId: message.parent_id,
        createdAt: message.created_at,
        latencyMs: message.latency_ms,
        retrievalMs: message.retrieval_ms,
        model: message.model,
        parts: [...message.message_parts]
          .sort((a, b) => a.position - b.position)
          .map((part) => ({
            id: part.id,
            kind: part.kind,
            text: part.text,
            chunkId: part.chunk_id,
            toolName: part.tool_name,
            toolArgs: part.tool_args,
            toolResult: part.tool_result,
            // Embedded in the same round trip. A citation without its passage
            // would mean one read per specimen, and a long conversation has
            // forty of them.
            passage: part.document_chunks
              ? {
                  chunkId: part.document_chunks.id,
                  documentId: part.document_chunks.document_id,
                  documentTitle: part.document_chunks.documents?.title ?? "Untitled",
                  chunkIndex: part.document_chunks.chunk_index,
                  content: part.document_chunks.content,
                }
              : null,
          })),
      }));

    const detail: ChatDetail = {
      id: data.id,
      title: data.title,
      webSearch: data.web_search,
      documents: links
        .filter((link) => link.documents !== null)
        .map((link) => toDocumentEntry(link.documents)),
      scope: Object.fromEntries(
        links
          .filter((link) => link.documents !== null)
          .map((link) => [link.documents.id, link.enabled]),
      ),
      messages,
    };

    return ok(detail);
  },

  async createChat({ title, documentIds }) {
    // The RPC inserts the chat and its document links in one transaction, and
    // decides ownership from auth.uid() rather than from a parameter. Two
    // separate inserts from here could leave a chat with no documents attached.
    const { data, error } = await db.rpc("create_chat_with_documents", {
      p_title: title,
      p_document_ids: documentIds,
    });

    if (error) return err(AppError.badGateway(`could not start a conversation: ${error.message}`));
    if (!data) return err(AppError.badGateway("create_chat_with_documents returned no id"));

    return ok(data);
  },

  async renameChat(chatId, title) {
    const { error } = await db.from("chats").update({ title }).eq("id", chatId);

    if (error) return err(AppError.badGateway(`could not rename: ${error.message}`));

    return ok(undefined);
  },

  async removeChat(chatId) {
    const { error } = await db.from("chats").delete().eq("id", chatId);

    if (error) return err(AppError.badGateway(`could not delete: ${error.message}`));

    return ok(undefined);
  },

  async setDocumentScope({ chatId, documentId, enabled }) {
    const { error } = await db
      .from("chat_documents")
      .update({ enabled })
      .eq("chat_id", chatId)
      .eq("document_id", documentId);

    if (error) return err(AppError.badGateway(`could not change the scope: ${error.message}`));

    return ok(undefined);
  },

  async addDocumentsToChat({ chatId, documentIds }) {
    const { data: existing, error: readError } = await db
      .from("chat_documents")
      .select("position")
      .eq("chat_id", chatId)
      .order("position", { ascending: false })
      .limit(1);

    if (readError)
      return err(AppError.badGateway(`could not read the scope: ${readError.message}`));

    const next = (existing[0]?.position ?? -1) + 1;

    const { error } = await db.from("chat_documents").upsert(
      documentIds.map((documentId, index) => ({
        chat_id: chatId,
        document_id: documentId,
        position: next + index,
      })),
      { onConflict: "chat_id,document_id", ignoreDuplicates: true },
    );

    if (error) return err(AppError.badGateway(`could not add the document: ${error.message}`));

    return ok(undefined);
  },

  async removeDocument(documentId) {
    const { error } = await db.from("documents").delete().eq("id", documentId);

    if (error) return err(AppError.badGateway(`could not delete the document: ${error.message}`));

    return ok(undefined);
  },

  async setWebSearch(chatId, enabled) {
    const { error } = await db.from("chats").update({ web_search: enabled }).eq("id", chatId);

    if (error) return err(AppError.badGateway(`could not change web search: ${error.message}`));

    return ok(undefined);
  },

  async usage() {
    // Counted by the database rather than by fetching rows and measuring the
    // arrays. head: true sends no rows at all.
    const counts = await Promise.all(
      (["documents", "chats", "messages", "document_chunks"] as const).map((table) =>
        db.from(table).select("*", { count: "exact", head: true }),
      ),
    );

    const failed = counts.find((result) => result.error);
    if (failed?.error) {
      return err(AppError.badGateway(`could not count usage: ${failed.error.message}`));
    }

    const { data: tokens, error: tokenError } = await db
      .from("messages")
      .select("tokens_in, tokens_out")
      .not("tokens_in", "is", null);

    if (tokenError) {
      return err(AppError.badGateway(`could not read token usage: ${tokenError.message}`));
    }

    const usage: AccountUsage = {
      documents: counts[0].count ?? 0,
      chats: counts[1].count ?? 0,
      messages: counts[2].count ?? 0,
      chunks: counts[3].count ?? 0,
      tokensIn: tokens.reduce((total, row) => total + (row.tokens_in ?? 0), 0),
      tokensOut: tokens.reduce((total, row) => total + (row.tokens_out ?? 0), 0),
    };

    return ok(usage);
  },
});

type DocumentRow = {
  id: string;
  title: string;
  kind: DocumentEntry["kind"];
  status: DocumentEntry["status"];
  byte_size: number | null;
  chunk_count: number;
  expected_chunks: number | null;
  error: string | null;
  created_at: string;
  indexed_at: string | null;
};

const toDocumentEntry = (row: DocumentRow): DocumentEntry => ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  status: row.status,
  byteSize: row.byte_size,
  chunkCount: row.chunk_count,
  expectedChunks: row.expected_chunks,
  error: row.error,
  createdAt: row.created_at,
  indexedAt: row.indexed_at,
});
