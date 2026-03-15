"use client";

import { useCallback } from "react";
import {
  getAllAcceptedFileTypes,
  getFileTypeConfig,
} from "@/constants/file-types";
import { isValidUrl } from "@/utils/upload-utils";
import { TypeUploadError } from "@/types/upload";

const MAX_FILE_NAME_LENGTH = 255;
const BLOCKED_DOMAINS = ["localhost", "127.0.0.1", "0.0.0.0"];

/**
 * A custom hook that provides memoized validation functions for file and URL uploads.
 */
export const useUploadValidation = ({
  createUploadError,
}: {
  createUploadError: (
    type: TypeUploadError["type"],
    message: string,
    originalError?: unknown,
    retryable?: boolean,
  ) => TypeUploadError;
}) => {
  const acceptedFileTypes = getAllAcceptedFileTypes();

  /**
   * Validates a `File` object against size, type, and name constraints.
   *
   * @param {File} file - The file object from a file input.
   * @returns {TypeUploadError | null} A structured error object if validation fails, otherwise `null`.
   */
  const validateFile = useCallback(
    (file: File): TypeUploadError | null => {
      const config = getFileTypeConfig(file.type);
      if (file.size > config.maxSize) {
        return createUploadError(
          "validation",
          `File exceeds ${config.maxSize / 1024 / 1024}MB limit.`,
        );
      }
      if (!acceptedFileTypes.some((type) => file.type.includes(type))) {
        return createUploadError(
          "validation",
          `File type "${file.type}" is not supported.`,
        );
      }
      if (file.size === 0) {
        return createUploadError(
          "validation",
          "The selected file appears to be empty.",
        );
      }
      if (file.name.length > MAX_FILE_NAME_LENGTH) {
        return createUploadError("validation", "The file name is too long.");
      }
      return null;
    },
    [acceptedFileTypes, createUploadError],
  );

  /**
   * Validates a URL string for proper format and ensures it is not a local address.
   *
   * @param {string} url - The URL string to validate.
   * @returns {TypeUploadError | null} A structured error object if validation fails, otherwise `null`.
   */
  const validateUrl = useCallback(
    (url: string): TypeUploadError | null => {
      if (!isValidUrl(url)) {
        return createUploadError(
          "validation",
          "Please enter a valid URL (e.g., https://example.com).",
        );
      }
      try {
        const parsedUrl = new URL(url);
        if (
          BLOCKED_DOMAINS.some((domain) => parsedUrl.hostname.includes(domain))
        ) {
          return createUploadError(
            "validation",
            "Local URLs are not supported.",
          );
        }
      } catch {
        return createUploadError("validation", "Invalid URL format.");
      }
      return null;
    },
    [createUploadError],
  );

  return { validateFile, validateUrl };
};
