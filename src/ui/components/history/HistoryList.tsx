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
      <section key={month} className="mb-9">
        <h2 className="mb-1 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.14em]">
          {month}
        </h2>

        <ul className="m-0 list-none p-0">
          {entries.map((chat) => (
            <li key={chat.id} className="border-rule border-b py-3.5">
              <Link href={DASHBOARD_ROUTES.CHAT(chat.id)} className="block">
                <span className="line-clamp-2 max-w-[62ch] font-light font-reading text-[1.18rem] text-ink leading-snug">
                  {chat.title ?? "Untitled"}
                </span>
              </Link>

              {/* One line of record under the question, delete included. It
                  sat at the right edge of the column, a thousand pixels from
                  the thing it deletes, and before that it only appeared on
                  hover, which is a control nobody can see. */}
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-record text-label text-faint">
                <time dateTime={chat.updatedAt}>{formatWhen(chat.updatedAt)}</time>

                {chat.documents.length > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="min-w-0 max-w-[40ch] truncate text-soft">
                      {chat.documents.map((document) => document.title).join(", ")}
                    </span>
                  </>
                ) : null}

                <span aria-hidden>·</span>
                {chat.messageCount === 0 ? (
                  <span>never answered</span>
                ) : (
                  <span>
                    {chat.messageCount} message{chat.messageCount === 1 ? "" : "s"}
                  </span>
                )}

                <span aria-hidden>·</span>
                <DeleteChat chatId={chat.id} title={chat.title ?? "Untitled"} />
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
