"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { askFromHome } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";
import type { ChatEntry, DocumentEntry } from "@/core/workspace/workspace.types";
import { describeDocument, formatWhen, kindLabel } from "@/ui/components/documents/document.format";
import { useDocumentProgress } from "@/ui/hooks/useDocumentProgress";
import { useUpload } from "@/ui/hooks/useUpload";
import { AddSource } from "./AddSource";
import { HomeComposer } from "./HomeComposer";

/**
 * The home of the product: your name, one place to type a question, and the
 * documents it will read.
 *
 * Two rebuilds got here. The first made you tick boxes and press Start Reading,
 * which is the `chat_documents` join table talking rather than a person. The
 * second removed the boxes but was still a file manager: a drop zone, a list of
 * files, and the thing you came to do — ask something — two screens away.
 *
 * The question is the screen now. Everything ready is in scope by default, so
 * somebody who has added one document can type and press Enter, and somebody
 * with five can uncheck the two they do not mean. Nothing on it is addressed to
 * whoever built it: no capability matrix, no passage counts as a headline, no
 * word a person would have to learn.
 */
export const HomeSurface = ({
  chrome,
  account,
  documents: seed,
  chats,
  userId,
}: {
  chrome: React.ReactNode;
  account: Account | null;
  documents: DocumentEntry[];
  chats: ChatEntry[];
  userId: string;
}) => {
  const documents = useDocumentProgress(seed, userId);
  const { uploads, add, dismiss } = useUpload();

  const ready = documents.filter((document) => document.status === "ready");
  const working = documents.filter(
    (document) => document.status !== "ready" && document.status !== "failed",
  );

  // Everything ready, in scope, until somebody says otherwise. Defaulting to
  // nothing selected made the first act of every visit a chore.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [state, ask] = useActionState<ActionState, FormData>(askFromHome, emptyActionState);

  const inScope = ready.filter((document) => !excluded.has(document.id));

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const firstName = (account?.displayName ?? account?.email ?? "").split(/[\s@.]/)[0];

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
      {chrome}

      <main className="min-w-0 px-7 py-10 wide:px-10 wide:py-12">
        <div className="max-w-[86ch]">
          <h1 className="mb-2 font-light font-reading text-[1.9rem] text-ink leading-tight tracking-[-0.015em]">
            {firstName ? (
              <>
                Hello, <span className="text-mark">{capitalise(firstName)}</span>.
              </>
            ) : (
              "Hello."
            )}
          </h1>

          <p className="mb-9 max-w-[54ch] font-light font-reading text-[1.05rem] text-soft leading-relaxed">
            {ready.length === 0
              ? working.length > 0
                ? "Your first document is being read. It will be ready in a moment, and then you can ask it anything."
                : "Add a document below, and then ask it anything. Every answer will point at the lines it came from."
              : "Ask anything about what you have added. Every answer points at the lines it came from."}
          </p>

          {ready.length > 0 ? (
            <HomeComposer
              action={ask}
              error={state.error}
              documents={ready}
              excluded={excluded}
              onToggle={toggle}
              inScopeCount={inScope.length}
            />
          ) : null}

          <section className={ready.length > 0 ? "mt-12" : ""}>
            <h2 className="mb-3 flex items-baseline justify-between font-record text-label text-faint uppercase tracking-[0.13em]">
              <span>Your documents</span>
              {working.length > 0 ? <span>{working.length} still being read</span> : null}
            </h2>

            <AddSource uploads={uploads} onAdd={add} onDismiss={dismiss} />

            {documents.length > 0 ? (
              <ul className="m-0 list-none p-0">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-rule border-b py-3.5"
                  >
                    <span className="font-record text-label text-faint uppercase tracking-[0.1em]">
                      {kindLabel[document.kind]}
                    </span>
                    <span className="min-w-0 font-light font-reading text-[1.05rem] text-ink">
                      <span className="block truncate">{document.title}</span>
                      <span className="mt-1 block font-record text-label text-faint">
                        {describeDocument(document)}
                      </span>
                    </span>
                    <span
                      className={`text-right font-record text-label ${
                        document.status === "failed" ? "text-danger" : "text-faint"
                      }`}
                    >
                      {document.status === "ready"
                        ? excluded.has(document.id)
                          ? "not in this question"
                          : "in this question"
                        : document.status === "failed"
                          ? "could not be read"
                          : "reading it"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </main>

      <aside className="border-rule border-t px-7 py-10 wide:border-t-0 wide:border-l wide:bg-panel wide:py-12">
        <h2 className="mb-5 flex items-baseline justify-between border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
          <span>What you asked before</span>
          {chats.length > 0 ? <span>{chats.length}</span> : null}
        </h2>

        {chats.length === 0 ? (
          <p className="m-0 max-w-[32ch] font-light font-reading text-[0.98rem] text-soft leading-relaxed">
            Nothing yet. Every question you ask stays here with the answer and its sources, so you
            can come back to it.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-0 p-0">
            {chats.slice(0, 9).map((chat) => (
              <li key={chat.id} className="border-rule border-b last:border-b-0">
                <Link href={DASHBOARD_ROUTES.CHAT(chat.id)} className="block py-3.5">
                  <span className="line-clamp-2 font-light font-reading text-[1rem] text-ink">
                    {chat.title ?? "Untitled"}
                  </span>
                  <span className="mt-1 flex flex-wrap items-baseline gap-x-2 font-record text-label text-faint">
                    <time dateTime={chat.updatedAt}>{formatWhen(chat.updatedAt)}</time>
                    {chat.documents.length > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="min-w-0 truncate">
                          {chat.documents.map((document) => document.title).join(", ")}
                        </span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {chats.length > 9 ? (
          <p className="mt-5 font-record text-label text-faint">
            <Link
              href={DASHBOARD_ROUTES.HISTORY}
              className="border-rule border-b pb-0.5 hover:text-ink"
            >
              All {chats.length} questions
            </Link>
          </p>
        ) : null}
      </aside>
    </div>
  );
};

/** `abhishek` from an email local part reads better with a capital. */
const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
