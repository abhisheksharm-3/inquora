import type { Metadata } from "next";
import { Suspense } from "react";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { DocumentShelf } from "@/ui/components/settings/DocumentShelf";
import { listDocuments, readUsage } from "../queries";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your documents, and what this account has used.",
};

/**
 * Surface 09. The apparatus carries what this account has actually used, which
 * is the one thing a settings page owes you and the thing most of them hide.
 *
 * The largest file in the old interface was this page's loading skeleton: 421
 * lines, larger than the chat interface at 290. There is no skeleton here. The
 * shell paints, and each section streams in when its query answers.
 */
const SettingsPage = () => (
  <div className="grid min-h-dvh grid-cols-1 content-start wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
    <Chrome current="settings" />

    <main className="min-w-0 px-6 py-7 wide:px-9 wide:py-8">
      <h1 className="mb-6 font-light font-reading text-[1.55rem] leading-tight">Your documents.</h1>

      <Suspense
        fallback={
          <p className="font-record text-label text-faint uppercase tracking-[0.14em]">Reading</p>
        }
      >
        <Shelf />
      </Suspense>
    </main>

    <aside className="border-rule border-t px-6 py-7 wide:border-t-0 wide:border-l wide:bg-panel">
      <Suspense fallback={null}>
        <Usage />
      </Suspense>
    </aside>
  </div>
);

const Shelf = async () => <DocumentShelf documents={await listDocuments()} />;

const Usage = async () => {
  const usage = await readUsage();

  if (!usage) return null;

  const entries: Entry[] = [
    {
      kind: "operation",
      tick: "01",
      title: "Indexed",
      detail: `${usage.documents} document${usage.documents === 1 ? "" : "s"} · ${usage.chunks.toLocaleString()} passages`,
    },
    {
      kind: "operation",
      tick: "02",
      title: "Asked",
      detail: `${usage.chats} conversation${usage.chats === 1 ? "" : "s"} · ${usage.messages} message${usage.messages === 1 ? "" : "s"}`,
    },
    {
      kind: "operation",
      tick: "03",
      title: "Tokens",
      // Both directions, because output is the expensive one and a single
      // total hides which of the two is growing.
      detail: `${usage.tokensIn.toLocaleString()} in · ${usage.tokensOut.toLocaleString()} out`,
    },
    {
      kind: "operation",
      tick: "04",
      title: "Embedding",
      detail: "1024 dimensions, self-hosted. Passages are embedded once and reused.",
    },
  ];

  return <ApparatusColumn entries={entries} label="What this account has used" />;
};

export default SettingsPage;
