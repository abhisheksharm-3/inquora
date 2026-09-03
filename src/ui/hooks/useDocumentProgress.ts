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
 * fields this needs. The topic is private and authorized by a policy on
 * `realtime.messages`, so a crafted `user:<someone else>` topic is refused by
 * the database rather than filtered here.
 *
 * Two bugs made this look broken, and both were silent.
 *
 * The socket has to authenticate before it joins. A private topic is authorized
 * `to authenticated`, so a socket presenting no token joined as `anon`, the
 * policy refused the read, and no event arrived — which is indistinguishable
 * from a subscription with nothing to report.
 *
 * And the payload is the row itself, not a wrapper around it. Migration 0025
 * shapes it deliberately, in camelCase, because broadcasting the whole row
 * shipped the document's entire text twice per event. This read
 * `payload.record` with snake_case keys, a shape that never existed, so
 * anything that did arrive was discarded.
 *
 * Both were found by connecting a real client to the real project and watching
 * one document change, rather than by reasoning about it.
 */
export const useDocumentProgress = (seed: DocumentEntry[], userId: string): DocumentEntry[] => {
  const supabase = useSupabase();
  const [documents, setDocuments] = useState(seed);

  // The server render is the source of truth on arrival: a navigation back to
  // this surface must not keep showing a list assembled from old events.
  useEffect(() => setDocuments(seed), [seed]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const listen = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      await supabase.realtime.setAuth(data.session?.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "document_progress" }, ({ payload }) => {
          const event = payload as Partial<Broadcast> | undefined;
          if (!event || typeof event.id !== "string") return;

          setDocuments((current) => merge(current, event as Broadcast));
        })
        .subscribe();
    };

    void listen();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return documents;
};

/** Exactly what `broadcast_document_progress` sends. */
type Broadcast = {
  id: string;
  status: DocumentEntry["status"];
  chunkCount: number;
  expectedChunks: number | null;
  title: string;
  kind: DocumentEntry["kind"];
  error: string | null;
  byteSize: number | null;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
};

/**
 * An insert arrives as a document not in the list, so it is prepended; every
 * other event replaces the entry in place.
 */
const merge = (current: DocumentEntry[], event: Broadcast): DocumentEntry[] => {
  const existing = current.find((document) => document.id === event.id);

  const entry: DocumentEntry = {
    id: event.id,
    title: event.title,
    kind: event.kind,
    status: event.status,
    byteSize: event.byteSize ?? existing?.byteSize ?? null,
    chunkCount: event.chunkCount,
    expectedChunks: event.expectedChunks,
    error: event.error,
    createdAt: event.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    // Falls back to now rather than to the previous value: hearing from a
    // document is itself evidence that it moved, and this is what tells a
    // working document apart from a stalled one.
    updatedAt: event.updatedAt ?? new Date().toISOString(),
    indexedAt: event.indexedAt ?? existing?.indexedAt ?? null,
  };

  return existing
    ? current.map((document) => (document.id === event.id ? entry : document))
    : [entry, ...current];
};
