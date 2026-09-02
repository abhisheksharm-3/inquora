import type { AppError } from "@/core/errors";
import type { Result } from "@/core/result.types";

export interface MemoryRepository {
  remember(content: string): Promise<Result<string, AppError>>;
}
