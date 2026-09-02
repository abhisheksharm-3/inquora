"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { askFromHome } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";
import type { ChatEntry, DocumentEntry } from "@/core/workspace/workspace.types";
import { describeDocument, formatWhen, kindLabel } from "@/ui/components/documents/document.format";
import { openersFor } from "@/ui/components/documents/openers";
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
  const [question, setQuestion] = useState("");
  const [adding, setAdding] = useState(false);
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
  const openers = openersFor(inScope, 3);

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
      {chrome}

      <main className="px-7 py-12 wide:px-12 wide:py-16">
        <div className="mx-auto w-full max-w-[1320px]">
          <h1 className="mb-2.5 font-light font-reading text-[2.1rem] text-ink leading-tight tracking-[-0.02em]">
            {firstName ? (
              <>
                Hello, <span className="text-mark">{capitalise(firstName)}</span>.
              </>
            ) : (
              "Hello."
            )}
          </h1>

          <p className="mb-8 max-w-[52ch] font-light font-reading text-[1.08rem] text-soft leading-relaxed">
            {ready.length === 0
              ? working.length > 0
                ? "Your first document is being read. It will be ready in a moment, and then you can ask it anything."
                : "Add a document below, and then ask it anything. Every answer will point at the lines it came from."
              : "Ask anything about what you have added. Every answer points at the lines it came from."}
          </p>

          {ready.length > 0 ? (
            <>
              <HomeComposer
                action={ask}
                error={state.error}
                documents={ready}
                excluded={excluded}
                onToggle={toggle}
                inScopeCount={inScope.length}
                value={question}
                onChange={setQuestion}
              />

              {/* Questions worth asking of these particular documents, across
                  the width. A stack of three under a wide composer left the
                  sides empty and the page looking unfinished. */}
              {openers.length > 0 ? (
                <div className="mt-6">
                  <p className="mb-2.5 font-record text-label text-faint uppercase tracking-[0.13em]">
                    Or try
                  </p>
                  <ul
                    className="m-0 grid list-none gap-px border border-rule bg-rule p-0"
                    style={{
                      gridTemplateColumns: `repeat(${openers.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {openers.map((opener) => (
                      <li key={opener} className="bg-ground">
                        <button
                          type="button"
                          onClick={() => setQuestion(opener)}
                          className="h-full w-full px-4 py-4 text-left font-light font-reading text-[1rem] text-soft transition-colors duration-150 ease-out-quart hover:bg-panel hover:text-ink"
                        >
                          {opener}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-10 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section>
              <h2 className="mb-3 flex items-baseline justify-between gap-4 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
                <span>Your documents</span>
                <span className="flex items-baseline gap-5">
                  {working.length > 0 ? <span>{working.length} still being read</span> : null}
                  {ready.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAdding((open) => !open)}
                      className="tracking-[0.13em] text-mark uppercase"
                    >
                      {adding ? "Close" : "Add one"}
                    </button>
                  ) : null}
                </span>
              </h2>

              {/* Open on a first visit, because adding is the only thing to do
                  then, and folded away afterwards, because it is the rarest act
                  on the page once there is something to ask. */}
              {ready.length === 0 || adding ? (
                <div className="mb-7">
                  <AddSource uploads={uploads} onAdd={add} onDismiss={dismiss} />
                </div>
              ) : null}

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

            {chats.length > 0 ? (
              <section>
                <h2 className="mb-3 flex items-baseline justify-between border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
                  <span>Carry on with</span>
                  <Link
                    href={DASHBOARD_ROUTES.HISTORY}
                    className="tracking-[0.13em] hover:text-ink"
                  >
                    all {chats.length}
                  </Link>
                </h2>

                <ul className="m-0 list-none p-0">
                  {chats.slice(0, 6).map((chat) => (
                    <li key={chat.id} className="border-rule border-b">
                      <Link href={DASHBOARD_ROUTES.CHAT(chat.id)} className="block py-3">
                        <span className="line-clamp-2 font-light font-reading text-[1rem] text-ink">
                          {chat.title ?? "Untitled"}
                        </span>
                        <span className="mt-1 block font-record text-label text-faint">
                          <time dateTime={chat.updatedAt}>{formatWhen(chat.updatedAt)}</time>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

/** `abhishek` from an email local part reads better with a capital. */
const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
