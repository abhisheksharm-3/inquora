"use client";

import { useState, useTransition } from "react";
import { setDocumentScope, setWebSearch } from "@/app/(app)/actions";
import type { ChatDetail } from "@/core/workspace/workspace.types";

/**
 * What this conversation is reading, and whether it may reach the web.
 *
 * Both toggles used to snap back the moment they were released. They were built
 * on `useOptimistic`, which reverts to its base value when the transition ends
 * — and the base value is a prop from a server render that nothing re-read, so
 * the optimistic state was always discarded in favour of the stale one. The
 * write had actually succeeded; the interface just threw the result away.
 *
 * So the component owns the state. It changes immediately, the action runs, and
 * a failure rolls it back and says why. That is the same shape `useOptimistic`
 * offers, minus the assumption that something upstream will re-read.
 *
 * It also said what it was doing in dots. A dot is not a word: which of two
 * states it meant was a guess, and there was nothing to say the label could be
 * clicked at all.
 *
 * It sits inside the composer rather than above the transcript, because what a
 * question will read is part of asking it — which is where `/ask` already puts
 * the same control.
 */
export const ScopeBar = ({ chat }: { chat: ChatDetail }) => {
  const [scope, setScope] = useState(chat.scope);
  const [web, setWeb] = useState(chat.webSearch);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggleDocument = (id: string, enabled: boolean) => {
    setScope((current) => ({ ...current, [id]: enabled }));
    setError(null);

    startTransition(async () => {
      const form = new FormData();
      form.set("chatId", chat.id);
      form.set("documentId", id);
      form.set("enabled", String(enabled));

      const result = await setDocumentScope({}, form);

      if (result.error) {
        setScope((current) => ({ ...current, [id]: !enabled }));
        setError(result.error);
      }
    });
  };

  const toggleWeb = (enabled: boolean) => {
    setWeb(enabled);
    setError(null);

    startTransition(async () => {
      const form = new FormData();
      form.set("chatId", chat.id);
      form.set("enabled", String(enabled));

      const result = await setWebSearch({}, form);

      if (result.error) {
        setWeb(!enabled);
        setError(result.error);
      }
    });
  };

  const reading = chat.documents.filter((document) => scope[document.id] ?? true).length;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <span className="font-record text-label text-faint">
          Reading {reading} of {chat.documents.length}
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {chat.documents.map((document) => {
            const on = scope[document.id] ?? true;

            return (
              <button
                key={document.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDocument(document.id, !on)}
                title={on ? `Stop reading ${document.title}` : `Read ${document.title} again`}
                className={`inline-flex h-7 max-w-[28ch] items-center gap-2 rounded-full border px-3 font-record text-label transition-colors duration-150 ease-out-quart ${
                  on
                    ? "border-mark/40 bg-wash text-ink hover:border-mark"
                    : "border-rule text-faint line-through hover:text-soft"
                }`}
              >
                <span className="truncate">{document.title}</span>
              </button>
            );
          })}
        </span>

        {/* A labelled state rather than a dot. "Web" beside a dot said neither
            what it was nor which way it was set. */}
        <button
          type="button"
          aria-pressed={web}
          onClick={() => toggleWeb(!web)}
          title={
            web
              ? "Stop letting this conversation search the web"
              : "Let this conversation search the web when your documents cannot answer"
          }
          className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 font-record text-label transition-colors duration-150 ease-out-quart ${
            web
              ? "border-mark/40 bg-wash text-ink hover:border-mark"
              : "border-rule text-faint hover:text-soft"
          }`}
        >
          Web search {web ? "on" : "off"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 font-record text-label text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
