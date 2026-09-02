"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { ChatEntry } from "@/core/workspace/workspace.types";
import { formatWhen } from "@/ui/components/documents/document.format";

/**
 * Surface 08. Conversations as dated records under a month heading, with what
 * each one was about on the second line: a title alone tells you nothing three
 * weeks later.
 *
 * Search filters in the browser rather than on the server, because the whole
 * list is already here and a round trip per keystroke would be slower than the
 * filter it is asking for. That stops being true somewhere past a few thousand
 * conversations, which is a problem worth having.
 */
export const HistoryList = ({ chats }: { chats: ChatEntry[] }) => {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matching = needle
      ? chats.filter(
          (chat) =>
            chat.title?.toLowerCase().includes(needle) ||
            chat.documents.some((document) => document.title.toLowerCase().includes(needle)),
        )
      : chats;

    const byMonth = new Map<string, ChatEntry[]>();

    for (const chat of matching) {
      const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
        new Date(chat.updatedAt),
      );

      byMonth.set(month, [...(byMonth.get(month) ?? []), chat]);
    }

    return [...byMonth];
  }, [chats, query]);

  return (
    <>
      <label className="mb-6 block">
        <span className="mb-1.5 block font-record text-label text-faint uppercase tracking-[0.12em]">
          Search
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="By name, or by document"
          className="block h-11 w-full max-w-[40ch] border-0 border-rule border-b bg-transparent px-0 font-light font-reading text-[1.02rem] text-ink caret-mark placeholder:text-faint focus-visible:border-mark focus-visible:outline-none"
        />
      </label>

      {groups.length === 0 ? (
        <p className="border-rule border-y py-6 font-light font-reading text-[1.05rem] text-soft">
          {chats.length === 0
            ? "No conversations yet. Choose a document and ask it something."
            : `Nothing matches "${query.trim()}".`}
        </p>
      ) : (
        groups.map(([month, entries]) => (
          <section key={month} className="mb-7">
            <h2 className="mb-1 border-rule border-b pb-1.5 font-record text-label text-faint uppercase tracking-[0.14em]">
              {month}
            </h2>
            <ul className="m-0 list-none p-0">
              {entries.map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={DASHBOARD_ROUTES.CHAT(chat.id)}
                    className="grid min-h-11 grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-4 border-rule border-b py-3"
                  >
                    <time
                      dateTime={chat.updatedAt}
                      className="font-record text-label text-faint tabular"
                    >
                      {new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(
                        new Date(chat.updatedAt),
                      )}
                    </time>
                    <span className="min-w-0 font-light font-reading text-[1.04rem] text-ink">
                      <span className="block truncate">{chat.title ?? "Untitled"}</span>
                      <span className="mt-0.5 block truncate font-record text-label text-faint">
                        {chat.documents.length === 0
                          ? "no documents"
                          : chat.documents.map((document) => document.title).join(" · ")}
                      </span>
                    </span>
                    <span className="text-right font-record text-label text-faint">
                      {chat.messageCount} message{chat.messageCount === 1 ? "" : "s"}
                      <span className="block">{formatWhen(chat.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
};
