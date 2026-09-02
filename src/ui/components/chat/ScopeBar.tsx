"use client";

import { useOptimistic, useTransition } from "react";
import { setDocumentScope, setWebSearch } from "@/app/(app)/actions";
import type { ChatDetail } from "@/core/workspace/workspace.types";

/**
 * The set bar: what this conversation is reading, and what it may reach.
 *
 * A document toggles in and out of retrieval here, backed by
 * `chat_documents.enabled`, because "search only these two of my five" is the
 * first thing anybody reaches for and removing the document from the chat is
 * not the same act.
 *
 * `useOptimistic` rather than a spinner: the dot moves the moment it is clicked
 * and reverts if the write fails, which is honest about a toggle that takes 40ms
 * and would otherwise flicker.
 */
export const ScopeBar = ({ chat }: { chat: ChatDetail }) => {
  const [scope, setScope] = useOptimistic(
    chat.scope,
    (current: Record<string, boolean>, change: { id: string; enabled: boolean }) => ({
      ...current,
      [change.id]: change.enabled,
    }),
  );
  const [web, setWeb] = useOptimistic(chat.webSearch, (_current: boolean, next: boolean) => next);
  const [, startTransition] = useTransition();

  const toggleDocument = (id: string, enabled: boolean) =>
    startTransition(async () => {
      setScope({ id, enabled });

      const form = new FormData();
      form.set("chatId", chat.id);
      form.set("documentId", id);
      form.set("enabled", String(enabled));

      await setDocumentScope({}, form);
    });

  const toggleWeb = (enabled: boolean) =>
    startTransition(async () => {
      setWeb(enabled);

      const form = new FormData();
      form.set("chatId", chat.id);
      form.set("enabled", String(enabled));

      await setWebSearch({}, form);
    });

  return (
    <div className="mb-7 flex flex-wrap items-baseline gap-3.5 border-rule border-b pb-3 font-record text-label text-faint uppercase tracking-[0.1em]">
      <span className="text-soft">Reading</span>

      {chat.documents.map((document) => {
        const enabled = scope[document.id] ?? true;

        return (
          <button
            key={document.id}
            type="button"
            aria-pressed={enabled}
            onClick={() => toggleDocument(document.id, !enabled)}
            title={enabled ? `Stop searching ${document.title}` : `Search ${document.title} again`}
            className={`inline-flex min-h-11 items-center gap-1.5 ${
              enabled ? "text-soft" : "text-faint opacity-40"
            } hover:text-ink`}
          >
            <span
              aria-hidden
              className={`size-1 rounded-full ${enabled ? "bg-mark" : "bg-faint"}`}
            />
            <span className="max-w-[22ch] truncate normal-case">{document.title}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-pressed={web}
        onClick={() => toggleWeb(!web)}
        className={`ml-auto inline-flex min-h-11 items-center gap-1.5 ${
          web ? "text-soft" : "text-faint opacity-40"
        } hover:text-ink`}
      >
        <span aria-hidden className={`size-1 rounded-full ${web ? "bg-mark" : "bg-faint"}`} />
        Web
      </button>
    </div>
  );
};
