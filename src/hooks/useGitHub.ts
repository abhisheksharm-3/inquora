"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGitHubRepositoryInfo,
  isValidGitHubUrl,
  extractGitHubRepoId,
  processGitHubRepository,
} from "@/utils/processors/github-processor";
import {
  isValidGitHubUrl as isValidGitHubUrlSync,
  extractGitHubRepoInfo,
} from "@/utils/github-utils";
import { useUser } from "./useUser";
import { useFiles } from "./useFiles";
import { TypeUploadError } from "@/types/upload";

export const GITHUB_QUERY_KEY = ["github"];

interface UseGitHubOptions {
  enablePreview?: boolean;
  autoValidate?: boolean;
}

interface GitHubRepositoryPreview {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  size: number;
  lastUpdate: string;
}

interface GitHubProcessingResult {
  success: boolean;
  numDocs: number;
  error?: string;
}

export const useGitHub = (options: UseGitHubOptions = {}) => {
  const { enablePreview = true, autoValidate = true } = options;
  const queryClient = useQueryClient();
  const { userId, isAuthenticated } = useUser();
  const { uploadFileAsync } = useFiles();

  // Local state
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  const [repositoryId, setRepositoryId] = useState<string | null>(null);

  // Utility to create upload errors
  const createUploadError = useCallback(
    (
      type: TypeUploadError["type"],
      message: string,
      originalError?: unknown,
      retryable = false,
    ): TypeUploadError => {
      console.error(`GitHub Error [${type}]:`, message, originalError);
      return { type, message, originalError, retryable };
    },
    [],
  );

  // Computed values
  // Note: isValidUrl and repositoryId are now state variables updated via useEffect

  // Update isValidUrl and repositoryId when repositoryUrl changes
  useEffect(() => {
    const updateValidity = async () => {
      if (!repositoryUrl.trim()) {
        setIsValidUrl(null);
        setRepositoryId(null);
        return;
      }
      const valid = await isValidGitHubUrl(repositoryUrl);
      setIsValidUrl(valid);
      if (valid) {
        const id = await extractGitHubRepoId(repositoryUrl);
        setRepositoryId(id);
      } else {
        setRepositoryId(null);
      }
    };
    updateValidity();
  }, [repositoryUrl]);

  // Repository preview query
  const repositoryPreviewQuery = useQuery({
    queryKey: [...GITHUB_QUERY_KEY, "preview", repositoryUrl],
    queryFn: async (): Promise<GitHubRepositoryPreview> => {
      if (!repositoryUrl || !isValidUrl) {
        throw new Error("Invalid repository URL");
      }
      return getGitHubRepositoryInfo(repositoryUrl);
    },
    enabled: enablePreview && !!repositoryUrl && isValidUrl === true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on certain errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("not found") || errorMessage.includes("private")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Processing mutation
  const processRepositoryMutation = useMutation({
    mutationFn: async (params: {
      url: string;
      namespace: string;
    }): Promise<GitHubProcessingResult> => {
      return processGitHubRepository(params.url, params.namespace);
    },
    onSuccess: (result, variables) => {
      console.log(`GitHub repository processing completed for ${variables.url}:`, result);
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: [...GITHUB_QUERY_KEY, "preview", variables.url],
      });
    },
    onError: (error, variables) => {
      console.error(`GitHub repository processing failed for ${variables.url}:`, error);
    },
  });

  // URL validation
  const validateUrl = useCallback(
    async (url: string): Promise<string | null> => {
      if (!url.trim()) {
        return "Repository URL is required";
      }

      if (!(await isValidGitHubUrl(url))) {
        return "Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)";
      }

      if (!autoValidate) return null;

      setIsValidating(true);
      try {
        await getGitHubRepositoryInfo(url);
        setValidationError(null);
        return null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let userFriendlyMessage = "Unable to access this repository";

        if (errorMessage.includes("not found")) {
          userFriendlyMessage = "Repository not found or is private";
        } else if (errorMessage.includes("rate limit")) {
          userFriendlyMessage = "GitHub API rate limit exceeded. Please try again later.";
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          userFriendlyMessage = "Network error. Please check your connection and try again.";
        }

        setValidationError(userFriendlyMessage);
        return userFriendlyMessage;
      } finally {
        setIsValidating(false);
      }
    },
    [autoValidate],
  );

  // URL change handler
  const handleUrlChange = useCallback(
    (url: string) => {
      setRepositoryUrl(url);
      setValidationError(null);

      // Auto-validate after a short delay
      if (autoValidate && url.trim()) {
        const timeoutId = setTimeout(() => {
          validateUrl(url);
        }, 500);
        return () => clearTimeout(timeoutId);
      }
    },
    [autoValidate, validateUrl],
  );

  // Upload repository as file
  const uploadRepository = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      throw createUploadError("auth", "Authentication required to upload repository", null, false);
    }

    if (!repositoryUrl.trim()) {
      throw createUploadError("validation", "Repository URL is required", null, false);
    }

    const validationError = await validateUrl(repositoryUrl);
    if (validationError) {
      throw createUploadError("validation", validationError, null, false);
    }

    const repoId = repositoryId;
    if (!repoId) {
      throw createUploadError("validation", "Invalid repository URL format", null, false);
    }

    // Create a synthetic file object for GitHub repositories
    const fileName = `${repoId.replace("/", "_")}_repository.github`;
    const fileData = {
      name: fileName,
      type: "github",
      size: 0, // Will be determined during processing
      url: repositoryUrl,
      processing_status: "idle" as const,
    };

    // Create a dummy file object for the upload
    const dummyFile = new File([], fileName, { type: "application/json" });

    try {
      const uploadedFile = await uploadFileAsync({ file: dummyFile, fileData });

      // Start processing in the background
      processRepositoryMutation.mutate({
        url: repositoryUrl,
        namespace: uploadedFile.id,
      });

      return uploadedFile;
    } catch (error) {
      throw createUploadError(
        "server",
        error instanceof Error ? error.message : "Failed to upload repository",
        error,
        true,
      );
    }
  }, [
    isAuthenticated,
    userId,
    repositoryUrl,
    validateUrl,
    uploadFileAsync,
    processRepositoryMutation,
    createUploadError,
    repositoryId,
  ]);

  // Clear state
  const clearState = useCallback(() => {
    setRepositoryUrl("");
    setValidationError(null);
    setIsValidating(false);
  }, []);

  // Get repository preview if available
  const repositoryPreview = useMemo(() => {
    if (!enablePreview || !repositoryUrl || isValidUrl !== true) return null;
    return repositoryPreviewQuery.data || null;
  }, [enablePreview, repositoryUrl, isValidUrl, repositoryPreviewQuery.data]);

  return useMemo(
    () => ({
      // State
      repositoryUrl,
      setRepositoryUrl: handleUrlChange,
      isValidUrl,
      validationError,
      repositoryId,
      repositoryPreview,

      // Validation
      validateUrl,
      isValidating: isValidating || repositoryPreviewQuery.isLoading,

      // Preview query state
      isLoadingPreview: repositoryPreviewQuery.isLoading,
      previewError: repositoryPreviewQuery.error,

      // Upload
      uploadRepository,
      isUploading: processRepositoryMutation.isPending,
      uploadError: processRepositoryMutation.error,

      // Processing
      processRepository: processRepositoryMutation.mutate,
      processRepositoryAsync: processRepositoryMutation.mutateAsync,
      isProcessing: processRepositoryMutation.isPending,
      processingError: processRepositoryMutation.error,

      // Utilities
      clearState,
      isValidGitHubUrl: isValidGitHubUrlSync,
      extractGitHubRepoId: (url: string) => {
        const info = extractGitHubRepoInfo(url);
        return info ? `${info.owner}/${info.repo}` : null;
      },
    }),
    [
      repositoryUrl,
      handleUrlChange,
      isValidUrl,
      validationError,
      repositoryId,
      repositoryPreview,
      validateUrl,
      isValidating,
      repositoryPreviewQuery.isLoading,
      repositoryPreviewQuery.error,
      uploadRepository,
      processRepositoryMutation.isPending,
      processRepositoryMutation.error,
      processRepositoryMutation.mutate,
      processRepositoryMutation.mutateAsync,
      clearState,
    ],
  );
};

/**
 * Hook for GitHub repository validation only (lighter version)
 */
export const useGitHubValidation = () => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((inputUrl: string): string | null => {
    if (!inputUrl.trim()) {
      setError("Repository URL is required");
      return "Repository URL is required";
    }

    if (!isValidGitHubUrlSync(inputUrl)) {
      const errorMsg = "Please enter a valid GitHub repository URL";
      setError(errorMsg);
      return errorMsg;
    }

    setError(null);
    return null;
  }, []);

  const handleChange = useCallback(
    (newUrl: string) => {
      setUrl(newUrl);
      if (newUrl.trim()) {
        validate(newUrl);
      } else {
        setError(null);
      }
    },
    [validate],
  );

  return useMemo(
    () => ({
      url,
      setUrl: handleChange,
      error,
      validate,
      isValid: !error && url.trim().length > 0,
      isValidGitHubUrl: isValidGitHubUrlSync,
    }),
    [url, handleChange, error, validate],
  );
};
