import type { Metadata } from "next";
import { Suspense } from "react";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { HistoryList } from "@/ui/components/history/HistoryList";
import { listChats } from "../queries";

export const metadata: Metadata = {
  title: "History",
  description: "Every conversation, and what it was about.",
};

/**
 * Surface 08. The list streams inside `<Suspense>`, so the chrome and the
 * heading paint immediately rather than waiting on the query. That is what
 * replaced the `'use cache'` plan, which cannot be used for a per-user read.
 */
const HistoryPage = () => (
  <div className="grid min-h-dvh grid-cols-1 content-start wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
    <Chrome current="history" />

    <main className="min-w-0 px-6 py-7 wide:px-9 wide:py-8">
      <h1 className="mb-6 font-light font-reading text-[1.55rem] leading-tight">
        Everything you have asked.
      </h1>

      <Suspense
        fallback={
          <p className="font-record text-label text-faint uppercase tracking-[0.14em]">Reading</p>
        }
      >
        <Records />
      </Suspense>
    </main>

    <aside className="border-rule border-t px-6 py-7 wide:border-t-0 wide:border-l wide:bg-panel">
      <Suspense fallback={null}>
        <HistoryApparatus />
      </Suspense>
    </aside>
  </div>
);

const Records = async () => <HistoryList chats={await listChats()} />;

/**
 * The apparatus on a history page: what the account contains, counted, rather
 * than a repeat of the list beside it.
 */
const HistoryApparatus = async () => {
  const chats = await listChats();

  const documents = new Set(chats.flatMap((chat) => chat.documents.map((document) => document.id)));
  const messages = chats.reduce((total, chat) => total + chat.messageCount, 0);
  const busiest = [...chats].sort((a, b) => b.messageCount - a.messageCount)[0];

  const entries: Entry[] = [
    {
      kind: "operation",
      tick: "01",
      title: `${chats.length} conversation${chats.length === 1 ? "" : "s"}`,
      detail: `${messages} message${messages === 1 ? "" : "s"} across ${documents.size} document${documents.size === 1 ? "" : "s"}`,
    },
  ];

  if (busiest && busiest.messageCount > 0) {
    entries.push({
      kind: "operation",
      tick: "02",
      title: "Longest conversation",
      detail: `${busiest.title ?? "Untitled"} · ${busiest.messageCount} messages`,
    });
  }

  return <ApparatusColumn entries={entries} label="Apparatus" />;
};

export default HistoryPage;
