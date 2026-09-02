import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DASHBOARD_ROUTES } from "@/core/routes";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { AccountStats } from "@/ui/components/history/AccountStats";
import { HistoryList } from "@/ui/components/history/HistoryList";
import { listChats, readAccount, readUsage, searchChats } from "../queries";

export const metadata: Metadata = {
  title: "History",
  description: "Every question you have asked, and what it read.",
};

/**
 * Everything you have asked. One column: a search, then the questions by month.
 *
 * The version this replaces had a 330px panel holding one statistic — "3
 * conversations · 0 messages across 1 document", headed "This account · 1
 * note" — which took a third of the screen to say something nobody came for,
 * in a register written for whoever built it, and left the panel nine tenths
 * empty with a floating bottom edge. The count that was worth keeping is in
 * the heading.
 *
 * Search is a query parameter answered by Postgres, so the result is
 * shareable, the back button works, and the page holds no client state.
 */
const HistoryPage = async ({ searchParams }: { searchParams: Promise<{ q?: string }> }) => {
  const [{ q }, account] = await Promise.all([searchParams, readAccount()]);
  const query = q?.trim() ?? "";

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
      <Chrome current="history" account={account} />

      <main className="min-w-0 px-7 py-12 wide:px-12 wide:py-14">
        <div className="w-full max-w-[86ch]">
          <h1 className="mb-8 font-light font-reading text-[2.1rem] text-ink leading-tight tracking-[-0.02em]">
            Everything you have asked.
          </h1>

          {/* A GET form. Typing and pressing Enter changes the URL, Postgres
              answers it, and there is nothing to keep in sync. */}
          <form action={DASHBOARD_ROUTES.HISTORY} className="mb-10 flex items-center gap-3">
            <label htmlFor="q" className="sr-only">
              Search your questions
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search your questions"
              className="h-10 w-full max-w-[46ch] border-0 border-rule border-b bg-transparent px-0 font-light font-reading text-[1.05rem] text-ink caret-mark placeholder:text-faint focus-visible:border-mark focus-visible:outline-none"
            />
            <button
              type="submit"
              className="flex h-10 shrink-0 items-center rounded-hair border border-mark px-4 font-record text-label text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash"
            >
              Search
            </button>
            {query ? (
              <Link
                href={DASHBOARD_ROUTES.HISTORY}
                className="whitespace-nowrap font-record text-label text-faint hover:text-ink"
              >
                Clear
              </Link>
            ) : null}
          </form>

          <Suspense
            key={query}
            fallback={
              <p className="font-record text-label text-faint uppercase tracking-[0.14em]">
                Reading
              </p>
            }
          >
            <Questions query={query} />
          </Suspense>
        </div>
      </main>

      <aside className="border-rule border-t px-7 py-12 wide:border-t-0 wide:border-l wide:bg-panel wide:py-14">
        <Suspense fallback={null}>
          <Usage />
        </Suspense>
      </aside>
    </div>
  );
};

const Usage = async () => {
  const usage = await readUsage();

  return usage ? <AccountStats usage={usage} /> : null;
};

const Questions = async ({ query }: { query: string }) => {
  const chats = query ? await searchChats(query) : await listChats();

  if (chats.length === 0) {
    return (
      <div className="border-rule border-y py-9">
        <p className="m-0 max-w-[46ch] font-light font-reading text-[1.15rem] text-soft leading-relaxed">
          {query
            ? `Nothing you have asked matches "${query}".`
            : "You have not asked anything yet. Add a document and ask it something, and every question will be here with its answer and its sources."}
        </p>
        {query ? null : (
          <p className="mt-5 font-record text-label">
            <Link
              href={DASHBOARD_ROUTES.HOME}
              className="border-mark border-b pb-0.5 text-mark uppercase tracking-[0.12em] hover:bg-wash"
            >
              Ask something
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 font-record text-label text-faint">
        {query
          ? `${chats.length} question${chats.length === 1 ? "" : "s"} match "${query}"`
          : `${chats.length} question${chats.length === 1 ? "" : "s"}`}
      </p>
      <HistoryList chats={chats} />
    </>
  );
};

export default HistoryPage;
