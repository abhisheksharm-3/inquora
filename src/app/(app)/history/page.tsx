import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DASHBOARD_ROUTES } from "@/core/routes";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { QuestionList } from "@/ui/components/history/QuestionList";
import { listChats, readAccount, searchChats } from "../queries";

export const metadata: Metadata = {
  title: "History",
  description: "Every question you have asked, and what it read.",
};

/**
 * Everything you have asked.
 *
 * One column and no panel. Three earlier versions put something on the right —
 * a statistic, then five account numbers — and both times it was a page's worth
 * of width spent on something nobody came here for. What somebody came here for
 * is one question they remember asking, so the search is the second thing on
 * the page and the list is a table you can scan.
 *
 * Search is a `q` parameter answered by Postgres, so the result is shareable,
 * the back button works, and the page holds no client state.
 */
const HistoryPage = async ({ searchParams }: { searchParams: Promise<{ q?: string }> }) => {
  const [{ q }, account] = await Promise.all([searchParams, readAccount()]);
  const query = q?.trim() ?? "";

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
      <Chrome current="history" account={account} />

      <main className="px-7 py-12 wide:px-12 wide:py-14">
        <div className="w-full">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-light font-reading text-[2.1rem] text-ink leading-tight tracking-[-0.02em]">
              Everything you have asked.
            </h1>

            {/* A GET form. Typing and pressing Enter changes the URL, Postgres
                answers it, and there is nothing to keep in sync. */}
            <form action={DASHBOARD_ROUTES.HISTORY} className="flex items-center gap-3">
              <label htmlFor="q" className="sr-only">
                Search your questions
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search your questions"
                className="h-10 w-full min-w-[16rem] border-0 border-rule border-b bg-transparent px-0 font-light font-reading text-[1.02rem] text-ink caret-mark placeholder:text-faint focus-visible:border-mark focus-visible:outline-none"
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
          </div>

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
    </div>
  );
};

const Questions = async ({ query }: { query: string }) => {
  const chats = query ? await searchChats(query) : await listChats();

  if (chats.length === 0) {
    return (
      <div className="border-rule border-y py-10">
        <p className="m-0 max-w-[48ch] font-light font-reading text-[1.2rem] text-soft leading-relaxed">
          {query
            ? `Nothing you have asked matches "${query}".`
            : "You have not asked anything yet. Add a document and ask it something, and every question will be here with its answer and its sources."}
        </p>
        {query ? null : (
          <p className="mt-6">
            <Link
              href={DASHBOARD_ROUTES.HOME}
              className="inline-flex h-10 items-center rounded-hair border border-mark px-4 font-record text-label text-mark uppercase tracking-[0.12em] hover:bg-wash"
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
      <p className="mb-4 font-record text-label text-faint">
        {query
          ? `${chats.length} of your questions match "${query}"`
          : `${chats.length} question${chats.length === 1 ? "" : "s"}, newest first`}
      </p>
      <QuestionList chats={chats} />
    </>
  );
};

export default HistoryPage;
