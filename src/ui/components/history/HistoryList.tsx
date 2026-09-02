import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { ChatEntry } from "@/core/workspace/workspace.types";
import { formatWhen } from "@/ui/components/documents/document.format";
import { DeleteChat } from "./DeleteChat";

/**
 * Everything you have asked, grouped by month.
 *
 * A server component. The version this replaces was a client component holding
 * the whole list so it could filter it in the browser, which is the wrong shape
 * twice over: it downloads every conversation somebody has ever had, and it
 * stops working at the point search is worth having. Search is a query
 * parameter now and Postgres answers it.
 *
 * Each row is the question, because a conversation is named after its question.
 * The document under it is what tells two similar questions apart. It used to
 * carry "0 messages" on every row, which is a count of the join table rather
 * than anything a reader wants; a question with no answer says so instead.
 */
export const HistoryList = ({ chats }: { chats: ChatEntry[] }) => (
  <>
    {groupByMonth(chats).map(([month, entries]) => (
      <section key={month} className="mb-10">
        <h2 className="mb-1 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.14em]">
          {month}
        </h2>

        <ul className="m-0 list-none p-0">
          {entries.map((chat) => (
            <li
              key={chat.id}
              className="flex items-baseline gap-6 border-rule border-b py-4 transition-colors duration-150 ease-out-quart hover:bg-panel"
            >
              <Link
                href={DASHBOARD_ROUTES.CHAT(chat.id)}
                className="grid min-w-0 flex-1 grid-cols-[3.4rem_minmax(0,1fr)] items-baseline gap-5"
              >
                {/* The day only. The month is the heading above it, and the
                    first version printed both. */}
                <time
                  dateTime={chat.updatedAt}
                  className="font-record text-label text-faint tabular"
                >
                  {new Intl.DateTimeFormat("en", { day: "2-digit" }).format(
                    new Date(chat.updatedAt),
                  )}
                </time>

                <span className="min-w-0">
                  <span className="line-clamp-2 font-light font-reading text-[1.12rem] text-ink">
                    {chat.title ?? "Untitled"}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 font-record text-label text-faint">
                    <span>{formatWhen(chat.updatedAt)}</span>
                    {chat.documents.length > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="min-w-0 truncate">
                          {chat.documents.map((document) => document.title).join(", ")}
                        </span>
                      </>
                    ) : null}
                    {chat.messageCount === 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-soft">never answered</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </Link>

              <DeleteChat chatId={chat.id} title={chat.title ?? "Untitled"} />
            </li>
          ))}
        </ul>
      </section>
    ))}
  </>
);

const groupByMonth = (chats: ChatEntry[]): [string, ChatEntry[]][] => {
  const byMonth = new Map<string, ChatEntry[]>();

  for (const chat of chats) {
    const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
      new Date(chat.updatedAt),
    );

    byMonth.set(month, [...(byMonth.get(month) ?? []), chat]);
  }

  return [...byMonth];
};
