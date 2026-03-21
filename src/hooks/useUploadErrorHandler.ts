"use client";

import { useCallback } from "react";
import { getErrorMessage, TypeUploadAction } from "@/utils/upload-utils";
import { TypeUploadError, EnumUploadActionType } from "@/types/upload";

/** A map of regular expressions to error types for categorizing errors by their message. */
const errorTypeMap = new Map<RegExp, TypeUploadError["type"]>([
  [/fetch/i, "network"],
  [/timeout/i, "network"],
  [/5\d{2}/, "server"],
  [/401|unauthorized/i, "auth"],
  [/processing/i, "file_processing"],
  [/size|type|format/i, "validation"],
]);

/**
 * @typedef {object} UseUploadErrorHandlerReturn
 * @property {(type: TypeUploadError["type"], message: string, originalError?: unknown, retryable?: boolean) => TypeUploadError} createUploadError - A factory function to build a structured upload error object.
 * @property {(err: unknown) => void} setUploadError - A function that categorizes an unknown error and dispatches it to the upload state reducer.
 */

/**
 * A custom hook that provides centralized error handling logic for an upload process.
 *
 * It offers memoized utility functions to create, categorize, and dispatch
 * structured error objects to a `useReducer` state manager.
 *
 * @param {React.Dispatch<TypeUploadAction>} dispatch - The dispatch function from a `useReducer` hook that manages the upload state.
 * @returns {UseUploadErrorHandlerReturn} An object containing the error handling utility functions.
 */
export const useUploadErrorHandler = (
  dispatch: React.Dispatch<TypeUploadAction>,
) => {
  /**
   * Creates a structured error object and logs it to the console.
   * This function is memoized for performance.
   */
  const createUploadError = useCallback(
    (
      type: TypeUploadError["type"],
      message: string,
      originalError?: unknown,
      retryable = false,
    ): TypeUploadError => {
      console.error(`Upload Error [${type}]:`, message, originalError);
      return { type, message, originalError, retryable };
    },
    [],
  );

  /**
   * Extracts user-friendly message from various error formats
   */
  const extractUserFriendlyMessage = useCallback((err: unknown): string => {
    // If it's already a structured error object with our expected format
    if (typeof err === "object" && err !== null) {
      const errorObj = err as TypeUploadError;

      // Check if it has the message property (your validation errors)
      if (errorObj.message && typeof errorObj.message === "string") {
        return errorObj.message;
      }
    }

    // Fallback to the original getErrorMessage function
    return getErrorMessage(err);
  }, []);

  /**
   * Categorizes an unknown error by matching its message against predefined patterns.
   * Now properly extracts user-friendly messages from structured error objects.
   */
  const getCategorizedError = useCallback(
    (err: unknown): TypeUploadError => {
      // First, check if the error is already a properly structured TypeUploadError
      if (typeof err === "object" && err !== null) {
        const errorObj = err as TypeUploadError;

        // If it already has type, message, and retryable properties, use it directly
        if (
          errorObj.type &&
          errorObj.message &&
          typeof errorObj.retryable === "boolean"
        ) {
          return {
            type: errorObj.type,
            message: errorObj.message,
            originalError: err,
            retryable: errorObj.retryable,
          };
        }
      }

      // Extract the user-friendly message for pattern matching
      const message = extractUserFriendlyMessage(err);

      // Match against patterns to determine error type
      for (const [pattern, type] of errorTypeMap.entries()) {
        if (pattern.test(message)) {
          // Automatically set retryable to false for validation and auth errors.
          const isRetryable = type !== "validation" && type !== "auth";
          return createUploadError(type, message, err, isRetryable);
        }
      }

      // Default to an "unknown" error type, which is considered retryable.
      return createUploadError("unknown", message, err, true);
    },
    [createUploadError, extractUserFriendlyMessage],
  );

  /**
   * Takes an unknown error, categorizes it, and dispatches it to the reducer.
   * This is the primary function to be called from a `catch` block.
   */
  const setUploadError = useCallback(
    (err: unknown) => {
      const categorizedError = getCategorizedError(err);
      dispatch({
        type: EnumUploadActionType.SET_ERROR,
        payload: categorizedError,
      });
    },
    [dispatch, getCategorizedError],
  );

  return { createUploadError, setUploadError };
};
