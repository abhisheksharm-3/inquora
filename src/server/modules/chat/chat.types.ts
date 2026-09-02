import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result";
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
}

export interface ToolDependencies {
  context: ChatContext;
  retrieval: RetrievalPort;
  chunks: ChunkRangePort;
  memories: MemoryPort;
  /** Called with the chunk ids a search returned, so the answer can cite them. */
  onCitations: (chunkIds: string[]) => void;
}

export interface AppendArgs {
  chatId: string;
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
  model: () => Promise<Result<BaseChatModel, AppError>>;
}
