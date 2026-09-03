"use client";

import { useQuery } from "@tanstack/react-query";
import { listChatsAction, listDocumentsAction } from "@/app/(app)/actions";
import type { ChatEntry, DocumentEntry } from "@/core/workspace/workspace.types";

/**
 * The lists every signed-in surface reads, cached across navigations.
 *
 * TanStack Query was mounted from the first commit and used by nothing: every
 * read was a server component, so moving between Ask, History and Settings
 * re-queried Postgres for the same documents and the same conversations each
 * time. That is what these hooks fix, and this is the case the library exists
 * for — client-owned server state that several surfaces share.
 *
 * `initialData` is what makes it worth having rather than a step backwards. The
 * server still renders the first paint from its own read, so there is no
 * request waterfall and no spinner on arrival; the cache then answers every
 * later navigation, and refetches in the background once the data is a minute
 * old. Without it these would be client-side fetches with an empty first frame.
 *
 * The fetchers are server actions, so the query still runs as the signed-in
 * person against row-level security. Nothing about authorization moves.
 */
export const documentsKey = ["documents"] as const;
export const chatsKey = ["chats"] as const;

export const useDocuments = (initialData: DocumentEntry[]) =>
  useQuery({
    queryKey: documentsKey,
    queryFn: listDocumentsAction,
    initialData,
    // A minute, counted from mount rather than from a timestamp: the list
    // arrived with the page, so it is fresh, and anything older is refetched
    // behind whatever is already on screen. `initialDataUpdatedAt: Date.now()`
    // would say this more precisely and reads the clock during render, which
    // cacheComponents refuses to prerender.
    staleTime: 60_000,
  });

export const useChats = (initialData: ChatEntry[]) =>
  useQuery({
    queryKey: chatsKey,
    queryFn: listChatsAction,
    initialData,
    staleTime: 60_000,
  });
