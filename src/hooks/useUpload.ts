"use client";

import { useReducer, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFiles } from "@/hooks/useFiles";
import { useChats } from "@/hooks/useChats";
import { useUser } from "@/hooks/useUser";
import { useDocumentProcessor } from "@/hooks/useDocumentProcessor";
import { TypeFile, TypeChat } from "@/types/database";
import { getFileTypeConfig } from "@/constants/file-types";
import { TypeUseUploadLogicProps } from "@/types/upload";
import {
  getUrlType,
  initialUploadState,
  uploadReducer,
} from "@/utils/upload-utils";
import {
  _extractGitHubFilename,
  _extractWebPageTitle,
  _extractYoutubeTitle,
  _getHostnameFromUrl,
} from "@/utils/url-naming-utils";
import { useUploadErrorHandler } from "./useUploadErrorHandler";
import { useUploadValidation } from "./useUploadValidation";
import { EnumUploadActionType } from "@/types/upload";

// --- Constants ---
const MAX_CHAT_CREATION_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const NAVIGATION_DELAY_MS = 1000;
const UPLOAD_TIMEOUT_MS = 60000;

/**
 * A custom hook providing the complete logic for a file/URL upload modal.
 * It manages state, validation, error handling, document processing, and the submission flow with retries.
 *
 * @param fileType The type of content being uploaded (e.g., 'pdf', 'youtube').
 * @param onClose A function to call when the upload is complete to close the modal.
 */
export const useUploadLogic = ({
  fileType,
  onClose,
}: TypeUseUploadLogicProps) => {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  const { url, selectedFile, isRetrying } = state;

  // --- Hooks ---
  const router = useRouter();
  const { uploadFileAsync, isUploading, updateFileAsync } = useFiles();
  const { startChatWithFileAsync } = useChats();
  const { isAuthenticated, userId } = useUser();
  const { createUploadError, setUploadError } = useUploadErrorHandler(dispatch);
  const { validateFile, validateUrl } = useUploadValidation({
    createUploadError,
  });
  const documentProcessor = useDocumentProcessor();

  // --- Core Logic ---

  const _uploadFile = useCallback(
    async (file: File): Promise<TypeFile | null> => {
      dispatch({ type: EnumUploadActionType.SET_STATUS, payload: "uploading" });
      const uploadPromise = uploadFileAsync({
        file,
        fileData: { name: file.name, type: fileType, size: file.size },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("File upload timeout")),
          UPLOAD_TIMEOUT_MS,
        ),
      );
      return Promise.race([uploadPromise, timeoutPromise]);
    },
    [uploadFileAsync, fileType],
  );

  const _uploadUrl = useCallback(
    async (urlToUpload: string): Promise<TypeFile | null> => {
      dispatch({ type: EnumUploadActionType.SET_STATUS, payload: "uploading" });
      const urlType = getUrlType(urlToUpload, fileType);

      // Extract a meaningful filename based on URL type
      let urlFileName: string;
      if (urlType === "github") {
        urlFileName = await _extractGitHubFilename(urlToUpload);
      } else if (urlType === "web") {
        urlFileName = await _extractWebPageTitle(urlToUpload);
      } else if (urlType === "video" || fileType === "youtube") {
        urlFileName = await _extractYoutubeTitle(urlToUpload);
      } else {
        urlFileName = _getHostnameFromUrl(urlToUpload);
      }

      const uploadedFile = await uploadFileAsync({
        file: new File([""], urlFileName, { type: "text/plain" }),
        fileData: { name: urlFileName, type: urlType, size: 0 },
      });
      if (!uploadedFile) throw new Error("File creation failed for URL.");
      await updateFileAsync({
        fileId: uploadedFile.id,
        fileData: { url: urlToUpload },
      });

      // Update the file object with the URL for processing
      const updatedFile = { ...uploadedFile, url: urlToUpload };
      return updatedFile;
    },
    [uploadFileAsync, updateFileAsync, fileType],
  );

  const _processDocument = useCallback(
    async (file: TypeFile): Promise<void> => {
      dispatch({
        type: EnumUploadActionType.SET_STATUS,
        payload: "processing",
      });

      const result = await documentProcessor.processDocument(file);

      if (!result.success) {
        throw createUploadError(
          "file_processing",
          result.error || "Document processing failed",
          null,
          true,
        );
      }
    },
    [documentProcessor, createUploadError],
  );

  const _createChatWithRetry = useCallback(
    async (fileId: string): Promise<TypeChat> => {
      for (let i = 0; i <= MAX_CHAT_CREATION_RETRIES; i++) {
        try {
          if (i > 0)
            dispatch({
              type: EnumUploadActionType.SET_IS_RETRYING,
              payload: true,
            });
          const newChat = await startChatWithFileAsync(fileId);
          if (!newChat?.id) throw new Error("Chat created but ID is missing.");
          dispatch({
            type: EnumUploadActionType.SET_IS_RETRYING,
            payload: false,
          });
          return newChat;
        } catch (error) {
          if (i >= MAX_CHAT_CREATION_RETRIES) {
            throw createUploadError(
              "chat_creation",
              "Failed to create chat.",
              error,
              true,
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * 2 ** i),
          ); // Exponential backoff
        }
      }
      throw createUploadError(
        "chat_creation",
        "Chat creation failed after all retries.",
        null,
        true,
      );
    },
    [startChatWithFileAsync, createUploadError],
  );

  // --- UI Handlers ---

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
      } else {
        dispatch({ type: EnumUploadActionType.SET_FILE, payload: file });
      }
    },
    [validateFile, setUploadError],
  );

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: EnumUploadActionType.SET_URL, payload: e.target.value });
    },
    [],
  );

  const handleRemoveFile = useCallback(
    () => dispatch({ type: EnumUploadActionType.RESET_FILE }),
    [],
  );

  const handleRetry = useCallback(
    () => dispatch({ type: EnumUploadActionType.RETRY }),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      return setUploadError(
        createUploadError("auth", "You must be logged in.", null, false),
      );
    }

    const fileValidationError = selectedFile
      ? validateFile(selectedFile)
      : null;
    if (fileValidationError) return setUploadError(fileValidationError);

    const urlValidationError = url ? validateUrl(url) : null;
    if (urlValidationError) return setUploadError(urlValidationError);

    try {
      let uploadedFile: TypeFile | null = null;

      // Step 1: Upload the file or URL
      if (selectedFile) {
        uploadedFile = await _uploadFile(selectedFile);
      } else if (url) {
        uploadedFile = await _uploadUrl(url);
      } else {
        return setUploadError(
          createUploadError(
            "validation",
            "Please select a file or enter a URL.",
            null,
            false,
          ),
        );
      }

      if (!uploadedFile?.id) {
        throw createUploadError(
          "server",
          "File upload failed: Invalid server response.",
          null,
          true,
        );
      }

      // Step 2: Process the document immediately
      await _processDocument(uploadedFile);

      // Step 3: Create chat only after processing is complete
      const newChat = await _createChatWithRetry(uploadedFile.id);

      dispatch({ type: EnumUploadActionType.SET_STATUS, payload: "uploaded" });
      onClose();

      // Navigate to chat immediately since processing is complete
      setTimeout(() => router.push(`/chat/${newChat.id}`), NAVIGATION_DELAY_MS);
    } catch (err) {
      setUploadError(err);
    }
  }, [
    isAuthenticated,
    userId,
    selectedFile,
    url,
    validateFile,
    validateUrl,
    _uploadFile,
    _uploadUrl,
    _processDocument,
    _createChatWithRetry,
    onClose,
    router,
    setUploadError,
    createUploadError,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return {
    // State and derived values
    ...state,
    fileTypeConfig: getFileTypeConfig(fileType),
    isUploading,
    isRetrying,
    canRetry: state.error?.retryable ?? false,

    // Document processing state
    isProcessing: documentProcessor.isProcessing,
    processingProgress: documentProcessor.progress,
    processingError: documentProcessor.error,

    // UI event handlers
    handleFileChange,
    handleUrlChange,
    handleRemoveFile,
    handleSubmit,
    handleKeyDown,
    handleRetry,
    resetState: () => {
      dispatch({ type: EnumUploadActionType.RESET });
      documentProcessor.reset();
    },
  };
};
