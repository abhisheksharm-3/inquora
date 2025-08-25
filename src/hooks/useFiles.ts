"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import { TypeFile } from "@/types/TypeSupabase";
import { useUser } from "./useUser";
import { processPdfDocument, processGenericDocument } from "@/utils/processors";
import { TypeUpdateFileParams, TypeUploadFileParams } from "@/types/TypeContent";
import { useMemo } from "react";

export const FILES_QUERY_KEY = ["files"];

const STORAGE_BUCKET = "file-storage";
const PROCESSABLE_DOC_TYPES = new Set(["pdf", "doc", "docs", "sheet", "sheets", "slides"]);
const URL_BASED_TYPES = new Set(["url", "web", "youtube"]);

export const useFiles = () => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();
  const { userId } = useUser();

  const filesQuery = useQuery({
    queryKey: FILES_QUERY_KEY,
    queryFn: async (): Promise<TypeFile[]> => {
      if (!userId) return [];
      
      const { data, error: queryError } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false });
      
      if (queryError) throw queryError;
      return data as TypeFile[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const handleUpload = async ({ file, fileData }: TypeUploadFileParams): Promise<TypeFile> => {
    if (!userId) throw new Error("User not authenticated.");

    let fileUrl: string | null = null;
    if (!URL_BASED_TYPES.has(fileData.type || "")) {
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      fileUrl = urlData.publicUrl;
    }

    const { data: newFile, error: insertError } = await supabase
      .from("files")
      .insert({ 
        ...fileData, 
        user_id: userId, 
        url: fileUrl, 
        uploaded_at: new Date().toISOString() 
      })
      .select()
      .single();
      
    if (insertError || !newFile) throw insertError || new Error("Failed to create file record.");

    if (PROCESSABLE_DOC_TYPES.has(newFile.type || "")) {
      const processor = newFile.type === 'pdf' ? processPdfDocument : processGenericDocument;
      processor(file, newFile.id, newFile.type!).catch(err => 
        console.error(`Background processing failed for ${newFile.id}:`, err)
      );
    }
    
    return newFile;
  };

  const handleDelete = async (fileId: string): Promise<string> => {
    if (!userId) throw new Error("User not authenticated.");

    const { data: file, error: fetchError } = await supabase
      .from("files")
      .select("url")
      .eq("id", fileId)
      .single();
      
    if (fetchError) throw fetchError;

    if (file.url) {
      try {
        const filePath = new URL(file.url).pathname.split(`/${STORAGE_BUCKET}/`)[1];
        if (filePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        }
      } catch (e) { 
        console.error("Could not parse or delete file from storage:", e); 
      }
    }

    const { error: deleteError } = await supabase.from("files").delete().eq("id", fileId);
    if (deleteError) throw deleteError;

    return fileId;
  };

  const uploadFileMutation = useMutation({
    mutationFn: handleUpload,
    onSuccess: (newFile) => {
      queryClient.setQueryData<TypeFile[]>(FILES_QUERY_KEY, (old = []) => [newFile, ...old]);
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, fileData }: TypeUpdateFileParams) => {
      const { data, error: updateError } = await supabase
        .from("files")
        .update(fileData)
        .eq("id", fileId)
        .select()
        .single();
      if (updateError) throw updateError;
      return data as TypeFile;
    },
    onSuccess: (updatedFile) => {
      queryClient.setQueryData<TypeFile[]>(FILES_QUERY_KEY, (old = []) =>
        old.map(file => (file.id === updatedFile.id ? updatedFile : file))
      );
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: handleDelete,
    onSuccess: (deletedFileId) => {
      queryClient.setQueryData<TypeFile[]>(FILES_QUERY_KEY, (old = []) =>
        old.filter(file => file.id !== deletedFileId)
      );
    },
  });

  return useMemo(() => ({
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
  }), [
    filesQuery.data, filesQuery.isLoading, filesQuery.isError, filesQuery.error,
    uploadFileMutation.mutate, uploadFileMutation.mutateAsync, uploadFileMutation.isPending,
    updateFileMutation.mutate, updateFileMutation.mutateAsync, updateFileMutation.isPending,
    deleteFileMutation.mutate, deleteFileMutation.mutateAsync, deleteFileMutation.isPending,
  ]);
};

export function useFileById(fileId: string) {
  const supabase = supabaseBrowserClient();
  const { userId, isAuthenticated } = useUser();

  const isValidFileId = useMemo(() => 
    !!fileId && typeof fileId === "string" && fileId.trim() !== "", 
    [fileId]
  );

  return useQuery({
    queryKey: [...FILES_QUERY_KEY, fileId],
    queryFn: async (): Promise<TypeFile | null> => {
      if (!userId || !isValidFileId) return null;
      
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("id", fileId)
        .eq("user_id", userId)
        .single();
      
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      
      return data as TypeFile;
    },
    enabled: isAuthenticated && !!userId && isValidFileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}