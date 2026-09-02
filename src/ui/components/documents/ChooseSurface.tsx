"use client";

import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { ChatEntry, DocumentEntry } from "@/core/workspace/workspace.types";
import { useDocumentProgress } from "@/ui/hooks/useDocumentProgress";
import { useUpload } from "@/ui/hooks/useUpload";
import { DocumentList } from "./DocumentList";
import { formatWhen } from "./document.format";
import { UploadDrop } from "./UploadDrop";

/**
 * The home of the product: add a document, or ask one of the ones you have.
 *
 * What this replaces asked for three things a person never asked for. It made
 * you tick boxes and then press Start Reading, which is the `chat_documents`
 * join table talking rather than a person: nobody arrives thinking "I would
 * like to assemble a document set". Its right-hand column listed which tools
 * the selection switched on — query the spreadsheet, search the code — which is
 * a capability matrix for whoever built it. And the way to add a file sat below
 * the button that started reading, so the flow read backwards.
 *
 * Now: adding a file is first, because it is the first thing anybody does.
 * Clicking a file is the whole of starting a conversation. And the right-hand
 * column is where you left off, which is what a person wants from a home
 * screen and what fills a column that was holding one sentence.
 */
export const ChooseSurface = ({
  chrome,
  documents: seed,
  chats,
  userId,
}: {
  chrome: React.ReactNode;
  documents: DocumentEntry[];
  chats: ChatEntry[];
  userId: string;
}) => {
  const documents = useDocumentProgress(seed, userId);
  const { uploads, add, dismiss } = useUpload();

  const ready = documents.filter((document) => document.status === "ready").length;

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
      {chrome}

      <main className="min-w-0 px-7 py-10 wide:px-10 wide:py-12">
        <div>
          <h1 className="mb-3 max-w-[30ch] font-light font-reading text-[1.9rem] text-ink leading-tight tracking-[-0.015em]">
            {documents.length === 0 ? "Add something to read." : "What do you want to ask about?"}
          </h1>
          <p className="mb-9 max-w-[52ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
            {documents.length === 0
              ? "A report, a paper, a spreadsheet, a folder of code. Whatever you add, you can ask it questions and follow every answer back to the lines it came from."
              : "Pick a file to ask it something. You can bring more into the conversation once you are in it."}
          </p>

          <div className="max-w-[84ch]">
            <UploadDrop uploads={uploads} onAdd={add} onDismiss={dismiss} />
          </div>

          {documents.length > 0 ? (
            <section className="mt-11 max-w-[84ch]">
              <h2 className="mb-3 flex items-baseline justify-between font-record text-label text-faint uppercase tracking-[0.13em]">
                <span>Your files</span>
                {/* Only worth saying while something is still being read.
                    "1 of 1 ready" is a status line written for whoever built
                    the queue. */}
                {ready < documents.length ? (
                  <span>{documents.length - ready} still being read</span>
                ) : null}
              </h2>
              <DocumentList documents={documents} />
            </section>
          ) : null}
        </div>
      </main>

      <aside className="border-rule border-t px-7 py-10 wide:border-t-0 wide:border-l wide:bg-panel wide:py-12">
        <h2 className="mb-5 flex items-baseline justify-between border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
          <span>Where you left off</span>
          {chats.length > 0 ? <span>{chats.length}</span> : null}
        </h2>

        {chats.length === 0 ? (
          <p className="m-0 max-w-[32ch] font-light font-reading text-[0.98rem] text-soft leading-relaxed">
            Nothing yet. Your conversations appear here, with the documents they were about.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-0 p-0">
            {chats.slice(0, 8).map((chat) => (
              <li key={chat.id} className="border-rule border-b last:border-b-0">
                <Link href={DASHBOARD_ROUTES.CHAT(chat.id)} className="block py-3.5">
                  <span className="block truncate font-light font-reading text-[1rem] text-ink">
                    {chat.title ?? "Untitled"}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-2 font-record text-label text-faint">
                    <time dateTime={chat.updatedAt}>{formatWhen(chat.updatedAt)}</time>
                    <span aria-hidden>·</span>
                    <span>
                      {chat.messageCount} message{chat.messageCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {chats.length > 8 ? (
          <p className="mt-5 font-record text-label text-faint">
            <Link
              href={DASHBOARD_ROUTES.HISTORY}
              className="border-rule border-b pb-0.5 hover:text-ink"
            >
              All {chats.length} conversations
            </Link>
          </p>
        ) : null}
      </aside>
    </div>
  );
};
