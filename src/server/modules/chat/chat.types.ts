import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";
import type { RetrievalRequest, RetrievedChunk } from "@/server/modules/retrieval/retrieval.types";
import type { StreamEvent } from "@/server/platform/http/http.types";
import type { ChatContext, SendMessageRequest } from "./chat.schema";

/** What one answered message cost. Written to `messages`, so cost stays a SQL question. */
export interface TurnUsage {
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  /** Time spent inside retrieval tools, which is separate from time spent thinking. */
  retrievalMs: number;
}

export interface AnsweringAgent {
  /** Dispatch the first search without waiting to be asked. See ADR 0005. */
  warm(query: string): void;
  stream(query: string, signal?: AbortSignal): AsyncGenerator<StreamEvent>;
  /** The chunk ids every search returned, in order, for persistence as citations. */
  citedChunkIds(): string[];
  /** The answer text as streamed, for one `append_message` at the end. */
  answerText(): string;
  usage(): TurnUsage;
  systemPrompt(): string;
}

/** The retrieval surface the agent and its tools depend on. */
export interface RetrievalPort {
  retrieve(request: RetrievalRequest): Promise<Result<RetrievedChunk[], AppError>>;
}

export interface ChunkRangePort {
  range(args: {
    documentId: string;
    from: number;
    to: number;
  }): Promise<Result<RetrievedChunk[], AppError>>;
}

export interface MemoryPort {
  remember(content: string): Promise<Result<string, AppError>>;
}

export interface AgentDependencies {
  context: ChatContext;
  model: BaseChatModel;
  retrieval: RetrievalPort;
  chunks: ChunkRangePort;
  memories: MemoryPort;
  tables: TablesPort;
  structure: OutlinePort;
  slices: SlicePort;
  web: WebSearchPort;
}

/** The tabular surface the query_table tool depends on. */
export interface TablesPort {
  list(
    documentId: string,
  ): Promise<Result<{ name: string; header: string[]; rowCount: number }[], AppError>>;
  query(query: {
    documentId: string;
    tableName: string;
    sql: string;
    limit?: number;
  }): Promise<Result<Record<string, unknown>[], AppError>>;
}

/** The structural surface the outline and grep tools depend on. */
export interface OutlinePort {
  outline(documentId: string): Promise<Result<unknown, AppError>>;
  grep(query: {
    documentId: string;
    pattern: string;
    limit?: number;
  }): Promise<Result<{ path: string | null; lineNumber: number; line: string }[], AppError>>;
}

/** The by-position surface read_file and get_transcript depend on. */
export interface SlicePort {
  file(args: {
    documentId: string;
    path: string;
    fromLine?: number;
    toLine?: number;
  }): Promise<
    Result<
      { path: string; content: string; fromLine: number; toLine: number; lineCount: number }[],
      AppError
    >
  >;
  transcript(args: {
    documentId: string;
    startSeconds?: number;
    endSeconds?: number;
  }): Promise<Result<{ content: string; startSeconds: number; endSeconds: number }[], AppError>>;
}

/** The web surface, present only when the deployment has a provider configured. */
export interface WebSearchPort {
  readonly configured: boolean;
  search(
    query: string,
    limit?: number,
  ): Promise<Result<{ title: string; url: string; extract: string }[], AppError>>;
}

export interface ToolDependencies {
  context: ChatContext;
  retrieval: RetrievalPort;
  chunks: ChunkRangePort;
  memories: MemoryPort;
  tables: TablesPort;
  structure: OutlinePort;
  slices: SlicePort;
  web: WebSearchPort;
  /** Called with the chunk ids a search returned, so the answer can cite them. */
  onCitations: (chunkIds: string[]) => void;
}

export interface AppendArgs {
  chatId: string;
  /** The sender's own id, for the user message only. */
  clientMessageId?: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  citationChunkIds: string[];
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  retrievalMs?: number;
  model?: string;
}

export interface ChatRepository {
  context(chatId: string): Promise<Result<ChatContext, AppError>>;
  append(args: AppendArgs): Promise<Result<string, AppError>>;
  /** The id of an earlier message with this sender id, if the send is a repeat. */
  alreadySent(chatId: string, clientMessageId: string): Promise<Result<string | null, AppError>>;
}

export interface SendArgs extends SendMessageRequest {
  chatId: string;
  signal?: AbortSignal;
}

export interface ChatService {
  send(args: SendArgs): Promise<Result<ReadableStream<Uint8Array>, AppError>>;
}

export interface ChatServiceDependencies {
  repository: ChatRepository;
  retrieval: RetrievalPort;
  chunks: ChunkRangePort;
  memories: MemoryPort;
  tables: TablesPort;
  structure: OutlinePort;
  slices: SlicePort;
  web: WebSearchPort;
  model: () => Promise<Result<BaseChatModel, AppError>>;
}
