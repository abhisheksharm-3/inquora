import type { Metadata } from "next";
import { Suspense } from "react";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { AccountPanel } from "@/ui/components/settings/AccountPanel";
import { DocumentShelf } from "@/ui/components/settings/DocumentShelf";
import { listDocuments, readAccount, readUsage } from "../queries";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your account, your documents, and what this account holds.",
};

/**
 * Your account and everything in it.
 *
 * The panel used to be four numbered notes — "Indexed · 1 document · 9
 * passages", "Tokens · 0 in · 0 out", and a paragraph explaining that the
 * embedding has 1024 dimensions — under the heading "What this account has used
 * 4 notes". The embedding dimension is a fact about the implementation rather
 * than about the account, and it lives on /how-it-works with the others.
 *
 * A settings page owes you who you are signed in as, how you sign in, when you
 * joined, what the account holds, and a way to remove any of it. It now says
 * all of that.
 *
 * The largest file in the interface this replaced was this page's loading
 * skeleton: 421 lines, bigger than the chat surface. There is no skeleton. The
 * shell paints and each section streams in when its query answers.
 */
const SettingsPage = async () => {
  const account = await readAccount();

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
      <Chrome current="settings" account={account} />

      <main className="min-w-0 px-7 py-12 wide:px-12 wide:py-14">
        <div className="w-full max-w-[86ch]">
          <h1 className="mb-2.5 font-light font-reading text-[2.1rem] text-ink leading-tight tracking-[-0.02em]">
            Your documents.
          </h1>
          <p className="mb-9 max-w-[54ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
            Everything you have added. Deleting one removes its passages, its rows and the citations
            pointing at it, and it cannot be undone.
          </p>

          <Suspense
            fallback={
              <p className="font-record text-label text-faint uppercase tracking-[0.14em]">
                Reading
              </p>
            }
          >
            <Shelf />
          </Suspense>
        </div>
      </main>

      <aside className="border-rule border-t px-7 py-12 wide:border-t-0 wide:border-l wide:bg-panel wide:py-14">
        <Suspense fallback={null}>
          <Panel account={account} />
        </Suspense>
      </aside>
    </div>
  );
};

const Shelf = async () => <DocumentShelf documents={await listDocuments()} />;

const Panel = async ({ account }: { account: Awaited<ReturnType<typeof readAccount>> }) => (
  <AccountPanel account={account} usage={await readUsage()} />
);

export default SettingsPage;
