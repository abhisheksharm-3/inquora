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
        <h2 className="mb-2 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.14em]">
          {month}
        </h2>

        <ul className="m-0 list-none p-0">
          {entries.map((chat) => (
            <li key={chat.id} className="border-rule border-b py-4">
              <div className="flex items-baseline justify-between gap-6">
                <Link href={DASHBOARD_ROUTES.CHAT(chat.id)} className="min-w-0 flex-1">
                  <span className="line-clamp-2 max-w-[64ch] font-light font-reading text-[1.2rem] text-ink leading-snug">
                    {chat.title ?? "Untitled"}
                  </span>
                </Link>

                {/* Always visible. It was revealed on hover, which is
                    undiscoverable: a control nobody can see is a control
                    nobody has. */}
                <DeleteChat chatId={chat.id} title={chat.title ?? "Untitled"} />
              </div>

              <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-record text-label text-faint">
                <time dateTime={chat.updatedAt}>{formatWhen(chat.updatedAt)}</time>

                {chat.documents.length > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    {chat.documents.slice(0, 2).map((document) => (
                      <span
                        key={document.id}
                        className="max-w-[24ch] truncate rounded-full border border-rule px-2 py-0.5"
                      >
                        {document.title}
                      </span>
                    ))}
                    {chat.documents.length > 2 ? (
                      <span>and {chat.documents.length - 2} more</span>
                    ) : null}
                  </>
                ) : null}

                <span aria-hidden>·</span>
                {chat.messageCount === 0 ? (
                  <span className="text-soft">never answered</span>
                ) : (
                  <span>
                    {chat.messageCount} message{chat.messageCount === 1 ? "" : "s"}
                  </span>
                )}
              </p>
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
