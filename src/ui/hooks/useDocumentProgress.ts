"use client";

import { useEffect, useState } from "react";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { useSupabase } from "@/ui/providers/SupabaseProvider";

/**
 * Documents, seeded from the server render and kept current by broadcast.
 *
 * Broadcast rather than `postgres_changes`: postgres_changes evaluates every
 * subscriber's row-level security against every change, so its cost is
 * subscribers times changes, and its payload is a raw row rather than the
 * fraction this needs. The topic is private and authorized by a policy on
 * `realtime.messages`, so a crafted `user:<someone else>` topic is refused by
 * the database rather than filtered here.
 *
 * There is no polling fallback. If the socket drops, the surface still shows
 * what the server rendered, and the next navigation re-reads it.
 */
export const useDocumentProgress = (seed: DocumentEntry[], userId: string): DocumentEntry[] => {
  const supabase = useSupabase();
  const [documents, setDocuments] = useState(seed);

  // The server render is the source of truth on arrival: a navigation back to
  // this surface must not keep showing a list assembled from old events.
  useEffect(() => setDocuments(seed), [seed]);

  useEffect(() => {
    const channel = supabase
      .channel(`user:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "document_progress" }, ({ payload }) => {
        const record = (payload as { record?: Record<string, unknown> }).record;
        if (!record || typeof record.id !== "string") return;

        setDocuments((current) => merge(current, record));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return documents;
};

/**
 * An insert arrives as a document not in the list, so it is prepended; every
 * other event patches the entry in place. Only the five fields the trigger
 * fires on are read, because the rest of the row is not what changed.
 */
const merge = (current: DocumentEntry[], record: Record<string, unknown>): DocumentEntry[] => {
  const id = record.id as string;
  const patch = {
    title: typeof record.title === "string" ? record.title : undefined,
    status: record.status as DocumentEntry["status"] | undefined,
    chunkCount: typeof record.chunk_count === "number" ? record.chunk_count : undefined,
    expectedChunks: typeof record.expected_chunks === "number" ? record.expected_chunks : null,
    error: typeof record.error === "string" ? record.error : null,
  };

  const existing = current.find((document) => document.id === id);

  if (!existing) {
    const created: DocumentEntry = {
      id,
      title: patch.title ?? "Untitled",
      kind: (record.kind as DocumentEntry["kind"]) ?? "doc",
      status: patch.status ?? "pending",
      byteSize: typeof record.byte_size === "number" ? record.byte_size : null,
      chunkCount: patch.chunkCount ?? 0,
      expectedChunks: patch.expectedChunks,
      error: patch.error,
      createdAt:
        typeof record.created_at === "string" ? record.created_at : new Date().toISOString(),
      indexedAt: typeof record.indexed_at === "string" ? record.indexed_at : null,
    };

    return [created, ...current];
  }

  return current.map((document) =>
    document.id === id
      ? {
          ...document,
          title: patch.title ?? document.title,
          status: patch.status ?? document.status,
          chunkCount: patch.chunkCount ?? document.chunkCount,
          expectedChunks: patch.expectedChunks,
          error: patch.error,
          indexedAt: typeof record.indexed_at === "string" ? record.indexed_at : document.indexedAt,
        }
      : document,
  );
};
