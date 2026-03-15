"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/providers/SupabaseProvider";
import { TypeFile } from "@/types/database";
import { useUser } from "./useUser";
import {
  TypeUpdateFileParams,
  TypeUploadFileParams,
} from "@/types/content";
import { useMemo } from "react";
import { createFileRepository } from "@/data/repositories";
import { QUERY_KEYS, TIMING_CONSTANTS, FILE_CONSTANTS } from "@/config/constants";

const PROCESSABLE_DOC_TYPES = new Set([
  "pdf",
  "doc",
  "docs",
  "docx",
  "sheet",
  "sheets",
  "xls",
  "xlsx",
  "slide",
  "slides",
  "ppt",
  "pptx",
]);
const URL_BASED_TYPES = new Set(["url", "web", "youtube", "github", "video"]);

export const useFiles = () => {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { userId } = useUser();

  const fileRepository = useMemo(
    () => createFileRepository(supabase),
    [supabase]
  );

  const filesQuery = useQuery({
    queryKey: QUERY_KEYS.FILES,
    queryFn: async (): Promise<TypeFile[]> => {
      if (!userId) return [];
      return fileRepository.findAllByUserId(userId);
    },
    enabled: !!userId,
    staleTime: TIMING_CONSTANTS.CACHE_TIME_MS,
    gcTime: TIMING_CONSTANTS.CACHE_TIME_MS * 2,
  });

  const handleUpload = async ({
    file,
    fileData,
  }: TypeUploadFileParams): Promise<TypeFile> => {
    if (!userId) throw new Error("User not authenticated.");

    let fileUrl: string | null = null;
    if (!URL_BASED_TYPES.has(fileData.type || "")) {
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(FILE_CONSTANTS.STORAGE_BUCKET)
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(FILE_CONSTANTS.STORAGE_BUCKET)
        .getPublicUrl(filePath);
      fileUrl = urlData.publicUrl;
    }

    const { data: newFile, error: insertError } = await supabase
      .from("files")
      .insert({
        ...fileData,
        user_id: userId,
        url: fileUrl,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !newFile)
      throw insertError || new Error("Failed to create file record.");

    return newFile;
  };

  const handleDelete = async (fileId: string): Promise<string> => {
    if (!userId) throw new Error("User not authenticated.");

    const file = await fileRepository.findById(fileId);
    if (!file) throw new Error("File not found.");

    if (file.url) {
      try {
        const filePath = new URL(file.url).pathname.split(
          `/${FILE_CONSTANTS.STORAGE_BUCKET}/`,
        )[1];
        if (filePath) {
          await supabase.storage.from(FILE_CONSTANTS.STORAGE_BUCKET).remove([filePath]);
        }
      } catch (e) {
        console.error("Could not parse or delete file from storage:", e);
      }
    }

    await fileRepository.delete(fileId);
    return fileId;
  };

  const uploadFileMutation = useMutation({
    mutationFn: handleUpload,
    onSuccess: (newFile) => {
      queryClient.setQueryData<TypeFile[]>(QUERY_KEYS.FILES, (old = []) => [
        newFile,
        ...old,
      ]);
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, fileData }: TypeUpdateFileParams) => {
      return fileRepository.update(fileId, fileData);
    },
    onSuccess: (updatedFile) => {
      queryClient.setQueryData<TypeFile[]>(QUERY_KEYS.FILES, (old = []) =>
        old.map((file) => (file.id === updatedFile.id ? updatedFile : file)),
      );
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: handleDelete,
    onSuccess: (deletedFileId) => {
      queryClient.setQueryData<TypeFile[]>(QUERY_KEYS.FILES, (old = []) =>
        old.filter((file) => file.id !== deletedFileId),
      );
    },
  });

  return useMemo(
    () => ({
      files: filesQuery.data || [],
      isLoading: filesQuery.isLoading,
      isError: filesQuery.isError,
      error: filesQuery.error,
      uploadFile: uploadFileMutation.mutate,
      uploadFileAsync: uploadFileMutation.mutateAsync,
      isUploading: uploadFileMutation.isPending,
      updateFile: updateFileMutation.mutate,
      updateFileAsync: updateFileMutation.mutateAsync,
      isUpdating: updateFileMutation.isPending,
      deleteFile: deleteFileMutation.mutate,
      deleteFileAsync: deleteFileMutation.mutateAsync,
      isDeleting: deleteFileMutation.isPending,
    }),
    [
      filesQuery.data,
      filesQuery.isLoading,
      filesQuery.isError,
      filesQuery.error,
      uploadFileMutation.mutate,
      uploadFileMutation.mutateAsync,
      uploadFileMutation.isPending,
      updateFileMutation.mutate,
      updateFileMutation.mutateAsync,
      updateFileMutation.isPending,
      deleteFileMutation.mutate,
      deleteFileMutation.mutateAsync,
      deleteFileMutation.isPending,
    ],
  );
};

export function useFileById(fileId: string) {
  const supabase = useSupabase();
  const { userId, isAuthenticated } = useUser();

  const fileRepository = useMemo(
    () => createFileRepository(supabase),
    [supabase]
  );

  const isValidFileId = useMemo(
    () => !!fileId && typeof fileId === "string" && fileId.trim() !== "",
    [fileId],
  );

  return useQuery({
    queryKey: [...QUERY_KEYS.FILES, fileId],
    queryFn: async (): Promise<TypeFile | null> => {
      if (!userId || !isValidFileId) return null;
      return fileRepository.findById(fileId);
    },
    enabled: isAuthenticated && !!userId && isValidFileId,
    staleTime: TIMING_CONSTANTS.CACHE_TIME_MS,
    gcTime: TIMING_CONSTANTS.CACHE_TIME_MS * 2,
  });
}
