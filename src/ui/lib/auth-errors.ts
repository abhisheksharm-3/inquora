import { EnumAuthErrorType, type TypeAuthError, type TypeUnknownError } from "@/ui/lib/auth.types";
import { ErrorMessages, HttpStatusErrorMap } from "@/ui/lib/auth-error-messages";

/**
 * Normalizes an unknown error into a structured object with a message, code, and status.
 * @private
 */
const _normalizeUnknownError = (
  error: TypeUnknownError,
): { message: string; code?: string; status?: number } => {
  if (error instanceof Error) {
    const errObj = error as { code?: string; status?: number };
    return {
      message: error.message,
      code: errObj.code,
      status: errObj.status,
    };
  }

  if (error && typeof error === "object") {
    const errObj = error as {
      message?: string;
      error_description?: string;
      code?: string;
      error?: string;
      status?: number;
    };
    return {
      message: errObj.message || errObj.error_description || "An unknown error occurred.",
      code: errObj.code || errObj.error,
      status: errObj.status,
    };
  }

  return { message: String(error) };
};

/**
 * Builds the final TypeAuthError object.
 * @private
 */
const _buildAuthError = (
  normalizedError: { message: string; code?: string },
  errorInfo: {
    type: EnumAuthErrorType;
    userMessage: string;
    retryable: boolean;
    retryAfter?: number;
  },
  context?: Record<string, unknown>,
): TypeAuthError => {
  return {
    type: errorInfo.type,
    userMessage: errorInfo.userMessage,
    retryable: errorInfo.retryable,
    retryAfter: errorInfo.retryAfter,
    message: normalizedError.message,
    code: normalizedError.code,
    context,
  };
};

/**
 * Categorizes an unknown error into a structured TypeAuthError.
 * It identifies errors based on string patterns, HTTP status codes, or falls back to a generic type.
 *
 * @param error The unknown error to categorize.
 * @param context Optional additional data to attach to the categorized error.
 * @returns A structured TypeAuthError object.
 */
export const categorizeAuthError = (
  error: TypeUnknownError,
  context?: Record<string, unknown>,
): TypeAuthError => {
  const normalizedError = _normalizeUnknownError(error);
  const errorMessageLower = normalizedError.message.toLowerCase();

  // 1. Check for known error message patterns
  for (const [pattern, errorInfo] of Object.entries(ErrorMessages)) {
    if (errorMessageLower.includes(pattern)) {
      // Ensure errorInfo.type is always defined
      if (!errorInfo.type) {
        errorInfo.type = EnumAuthErrorType.UNKNOWN_ERROR;
      }
      return _buildAuthError(
        normalizedError,
        errorInfo as {
          type: EnumAuthErrorType;
          userMessage: string;
          retryable: boolean;
          retryAfter?: number;
        },
        context,
      );
    }
  }

  // 2. Check for HTTP status codes
  if (normalizedError.status && HttpStatusErrorMap.has(normalizedError.status)) {
    const errorInfo = HttpStatusErrorMap.get(normalizedError.status)!;
    return _buildAuthError(normalizedError, errorInfo, context);
  }

  // 3. Default to an unknown error
  const defaultErrorInfo = {
    type: EnumAuthErrorType.UNKNOWN_ERROR,
    userMessage: "An unexpected error occurred. Please try again or contact support.",
    retryable: true,
  };

  return _buildAuthError(normalizedError, defaultErrorInfo, context);
};

/**
 * A shared error handler that categorizes and re-throws errors as TypeAuthError.
 * If the error is already a categorized TypeAuthError, it is thrown as-is.
 *
 * @param error The unknown error caught in a try-catch block.
 * @param action A string describing the action that failed (e.g., 'login').
 * @param context Optional additional data for debugging.
 * @throws {TypeAuthError} Always throws a structured authentication error.
 */
export const handleAuthErrors = (
  error: unknown,
  action: string,
  context: Record<string, unknown> = {},
) => {
  // If the error is already one of our custom types, re-throw it.
  if (error && typeof error === "object" && "type" in error && "userMessage" in error) {
    throw error as TypeAuthError;
  }

  const categorizedError = categorizeAuthError(error, { action, ...context });
  throw categorizedError;
};
