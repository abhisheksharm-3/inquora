import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { ChatEntry } from "@/core/workspace/workspace.types";
import { Ago } from "@/ui/components/shared/Ago";
import { DeleteChat } from "./DeleteChat";

/**
 * Everything you have asked, as a table of questions.
 *
 * Three versions failed the same way: a stack of rows, each carrying a question
 * and then a line of dim mono under it saying the time, the documents, whether
 * it was answered and Delete, all in the same size and colour. Six of those is
 * six paragraphs of grey, and nothing in a row lined up with the same thing in
 * the row above.
 *
 * So it is columns. When, what you asked, what it read, and how it went, each
 * under a heading, aligned down the page. A list you can scan is a list where
 * the answer to one question is always in the same place.
 */
export const QuestionList = ({ chats }: { chats: ChatEntry[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[46rem] border-collapse">
      <thead>
        <tr className="border-rule border-b">
          {["When", "What you asked", "What it read", "", ""].map((heading, index) => (
            <th
              key={heading || index}
              scope="col"
              className="pb-2 pr-6 text-left font-normal font-record text-label text-faint uppercase tracking-[0.13em] last:pr-0"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {chats.map((chat) => (
          <tr key={chat.id} className="group border-rule border-b align-baseline">
            <td className="w-[9rem] py-4 pr-6 font-record text-label text-faint">
              <Ago iso={chat.updatedAt} />
            </td>

            <td className="py-4 pr-6">
              <Link
                href={DASHBOARD_ROUTES.CHAT(chat.id)}
                className="line-clamp-2 max-w-[52ch] font-light font-reading text-[1.12rem] text-ink leading-snug group-hover:text-mark"
              >
                {chat.title ?? "Untitled"}
              </Link>
            </td>

            <td className="w-[18rem] py-4 pr-6">
              {chat.documents.length === 0 ? (
                <span className="font-record text-label text-faint">nothing attached</span>
              ) : (
                <span className="flex flex-wrap gap-1.5">
                  {chat.documents.slice(0, 2).map((document) => (
                    <span
                      key={document.id}
                      className="max-w-[20ch] truncate rounded-full border border-rule px-2 py-0.5 font-record text-label text-soft"
                    >
                      {document.title}
                    </span>
                  ))}
                  {chat.documents.length > 2 ? (
                    <span className="py-0.5 font-record text-label text-faint">
                      +{chat.documents.length - 2}
                    </span>
                  ) : null}
                </span>
              )}
            </td>

            {/* Its own column, so "never answered" is somewhere the eye already
                knows to look rather than buried mid-sentence. */}
            <td className="w-[9rem] py-4 pr-6 font-record text-label">
              {chat.messageCount === 0 ? (
                <span className="text-soft">never answered</span>
              ) : (
                <span className="text-faint tabular">
                  {chat.messageCount} message{chat.messageCount === 1 ? "" : "s"}
                </span>
              )}
            </td>

            <td className="w-[6rem] py-4 text-right">
              <DeleteChat chatId={chat.id} title={chat.title ?? "Untitled"} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
