import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";
import type {
  AccountUsage,
  ChatDetail,
  ChatEntry,
  DocumentEntry,
  PassageInContext,
} from "@/core/workspace/workspace.types";

export interface WorkspaceRepository {
  listChats(): Promise<Result<ChatEntry[], AppError>>;
  listDocuments(): Promise<Result<DocumentEntry[], AppError>>;
  /** Ready documents whose title matches, for bringing one into a question. */
  findDocuments(query: string, limit: number): Promise<Result<DocumentEntry[], AppError>>;
  chat(chatId: string): Promise<Result<ChatDetail | null, AppError>>;
  createChat(args: { title: string; documentIds: string[] }): Promise<Result<string, AppError>>;
  renameChat(chatId: string, title: string): Promise<Result<void, AppError>>;
  removeChat(chatId: string): Promise<Result<void, AppError>>;
  setDocumentScope(args: {
    chatId: string;
    documentId: string;
    enabled: boolean;
  }): Promise<Result<void, AppError>>;
  addDocumentsToChat(args: {
    chatId: string;
    documentIds: string[];
  }): Promise<Result<void, AppError>>;
  removeDocument(documentId: string): Promise<Result<void, AppError>>;
  setWebSearch(chatId: string, enabled: boolean): Promise<Result<void, AppError>>;
  usage(): Promise<Result<AccountUsage, AppError>>;
  passage(chunkId: string): Promise<Result<PassageInContext | null, AppError>>;
}
