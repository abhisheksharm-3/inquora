/**
 * A collection of utility functions for handling uploads, URL validation, and errors.
 */

import { EnumUploadActionType } from "@/constants/EnumUploadData";
import { TypeUploadError, TypeUploadState } from "@/types/TypeUpload";

/**
 * Validates if a string is a well-formed URL with an http or https protocol.
 * @param {string} url The URL string to validate.
 * @returns {boolean} Returns true if the URL is valid, otherwise false.
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol.startsWith("http");
  } catch {
    return false;
  }
};

/**
 * Determines the type of content from a URL, specifically checking for YouTube links, GitHub repositories, and web pages.
 * @param {string} url The URL to analyze.
 * @param {string} fileType A pre-determined file type hint, which can also be 'youtube', 'github', or 'web'.
 * @returns {'youtube' | 'github' | 'web'} The determined type of the URL.
 */
export const getUrlType = (url: string, fileType: string): string => {
  // Check for YouTube URLs first
  if (
    fileType === "youtube" ||
    fileType === "video" || // Handle the case where fileType is "video" from FileTypes config
    url.includes("youtube.com/watch") ||
    url.includes("youtu.be/") ||
    url.includes("youtube.com/embed/") ||
    url.includes("youtube.com/v/") ||
    url.includes("googleusercontent.com/youtube.com/0") ||
    url.includes("googleusercontent.com/youtube.com/1")
  ) {
    return "youtube";
  }

  if (fileType === "github" || url.includes("github.com/")) {
    return "github";
  }

  // All other URLs are treated as web pages for scraping
  return "web";
};

/**
 * Converts an error of unknown type into a user-friendly message string.
 * It handles specific backend error messages to provide clearer context.
 * @param {unknown} error The caught error object.
 * @returns {string} A user-friendly error message.
 */
export const getErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "An unknown error occurred";

  const { message } = error;

  if (message.includes("NEXT_REDIRECT")) {
    return ""; // Not actually an error
  }

  if (message.includes("new row violates row-level security policy")) {
    return "Permission denied: You do not have permission to upload files. Please check that you are properly logged in.";
  }

  if (message.includes("JWT")) {
    return "Your session has expired. Please log in again.";
  }

  if (message.includes("bucket")) {
    return "Storage error: The file storage system is not properly configured.";
  }

  return message;
};

/**
 * Gets a display title for an upload error based on its type.
 * @param {string} type The type of the error (e.g., 'validation', 'network').
 * @returns {string} The corresponding error title.
 */
export const getUploadErrorTitle = (type: string) => {
  switch (type) {
    case "validation":
      return "Invalid Input";
    case "network":
      return "Connection Failed";
    case "server":
      return "Server Error";
    case "auth":
      return "Authentication Required";
    case "file_processing":
      return "File Processing Failed";
    case "chat_creation":
      return "Chat Creation Failed";
    default:
      return "Upload Failed";
  }
};

/**
 * Gets an object of Tailwind CSS classes for styling an error component.
 * It returns amber-colored classes for 'validation' errors and red for all others.
 * @param {string} type The type of the error, e.g., 'validation'.
 * @returns {{border: string, bg: string, titleText: string, messageText: string}} An object with CSS class names.
 */
export const getUploadErrorColorClasses = (type: string) => {
  if (type === "validation") {
    return {
      border: "border-amber-500",
      bg: "bg-amber-50",
      titleText: "text-amber-700",
      messageText: "text-amber-600",
    };
  }
  return {
    border: "border-red-500",
    bg: "bg-red-50",
    titleText: "text-red-700",
    messageText: "text-red-600",
  };
};

export const initialUploadState: TypeUploadState = {
  uploadStatus: "idle",
  fileName: "",
  url: "",
  error: null,
  selectedFile: null,
  retryCount: 0,
  isRetrying: false,
};

export type UploadAction =
  | {
      type: EnumUploadActionType.SET_STATUS;
      payload: TypeUploadState["uploadStatus"];
    }
  | { type: EnumUploadActionType.SET_FILE; payload: File }
  | { type: EnumUploadActionType.SET_URL; payload: string }
  | { type: EnumUploadActionType.SET_ERROR; payload: TypeUploadError | null }
  | { type: EnumUploadActionType.RESET_FILE }
  | { type: EnumUploadActionType.RESET }
  | { type: EnumUploadActionType.RETRY }
  | { type: EnumUploadActionType.SET_IS_RETRYING; payload: boolean };

export const uploadReducer = (
  state: TypeUploadState,
  action: UploadAction,
): TypeUploadState => {
  switch (action.type) {
    case EnumUploadActionType.SET_STATUS:
      return { ...state, uploadStatus: action.payload, error: null };
    case EnumUploadActionType.SET_FILE:
      return {
        ...initialUploadState,
        selectedFile: action.payload,
        fileName: action.payload.name,
      };
    case EnumUploadActionType.SET_URL:
      return {
        ...state,
        url: action.payload,
        selectedFile: null,
        fileName: "",
      };
    case EnumUploadActionType.SET_ERROR:
      return { ...state, error: action.payload, uploadStatus: "error" };
    case EnumUploadActionType.RESET_FILE:
      return { ...state, selectedFile: null, fileName: "" };
    case EnumUploadActionType.RESET:
      return initialUploadState;
    case EnumUploadActionType.RETRY:
      return {
        ...state,
        error: null,
        uploadStatus: "idle",
        retryCount: state.retryCount + 1,
      };
    case EnumUploadActionType.SET_IS_RETRYING:
      return { ...state, isRetrying: action.payload };
    default:
      return state;
  }
};
