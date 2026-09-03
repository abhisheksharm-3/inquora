"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { askFromHome } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";
import type { ChatEntry, DocumentEntry } from "@/core/workspace/workspace.types";
import { formatWhen } from "@/ui/components/documents/document.format";
import { openersFor } from "@/ui/components/documents/openers";
import { useDocumentProgress } from "@/ui/hooks/useDocumentProgress";
import { useUpload } from "@/ui/hooks/useUpload";
import { AddSource } from "./AddSource";
import { DocumentRow } from "./DocumentRow";
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
  const { uploads, add } = useUpload();

  const ready = documents.filter((document) => document.status === "ready");
  const working = documents.filter(
    (document) => document.status !== "ready" && document.status !== "failed",
  );

  /**
   * The documents this question will read, as an explicit set.
   *
   * It used to be "everything ready, minus what you excluded", which cannot
   * express a document the screen does not list — and the screen lists three.
   * Seeded with the most recent ones, so somebody with one document can type
   * and press Enter, and the picker in the composer reaches any of the others.
   */
  const [chosen, setChosen] = useState<Map<string, DocumentEntry>>(
    () =>
      new Map(
        seed
          .filter((document) => document.status === "ready")
          .slice(0, SHOWN)
          .map((document) => [document.id, document]),
      ),
  );

  // A document that finishes being read joins the question, because the only
  // reason somebody is watching it arrive is that they want to ask about it.
  const seen = useRef(new Set(seed.map((document) => document.id)));

  useEffect(() => {
    const arrived = documents.filter(
      (document) => document.status === "ready" && !seen.current.has(document.id),
    );

    for (const document of documents) seen.current.add(document.id);
    if (arrived.length === 0) return;

    setChosen((current) => {
      const next = new Map(current);
      for (const document of arrived) next.set(document.id, document);
      return next;
    });
  }, [documents]);
  const [question, setQuestion] = useState("");
  const [adding, setAdding] = useState(false);
  const [state, ask] = useActionState<ActionState, FormData>(askFromHome, emptyActionState);

  const inScope = [...chosen.values()];

  // An upload the server has not turned into a document row yet. Once it has,
  // the row itself reports progress from the database, so showing both would
  // show the same file twice.
  const pending = uploads.filter(
    (upload) => !upload.documentId || !documents.some((d) => d.id === upload.documentId),
  );

  const remove = (id: string) =>
    setChosen((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });

  const choose = (document: DocumentEntry) =>
    setChosen((current) => new Map(current).set(document.id, document));

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
                chosen={inScope}
                onRemove={remove}
                onChoose={choose}
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
                  {documents.length > SHOWN ? (
                    <Link
                      href={DASHBOARD_ROUTES.SETTINGS}
                      className="tracking-[0.13em] hover:text-ink"
                    >
                      all {documents.length}
                    </Link>
                  ) : null}
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
                  <AddSource onAdd={add} />
                </div>
              ) : null}

              {/* One list. A file still being uploaded is a dimmed row in it,
                  rather than a second list of files beside the list of files
                  with its own progress bar and its own words. */}
              {documents.length > 0 || pending.length > 0 ? (
                <ul className="m-0 list-none border-rule border-t p-0">
                  {pending.map((upload) => (
                    <DocumentRow key={upload.filename} upload={upload} />
                  ))}
                  {documents.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      inQuestion={chosen.has(document.id)}
                    />
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
                  {chats.slice(0, SHOWN).map((chat) => (
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

/**
 * How many rows either list shows.
 *
 * A cap rather than a scroll, so the lower half of the home screen is the same
 * height for somebody with two documents and somebody with two hundred. What is
 * past it lives on the surface built for it: documents in settings, where they
 * can also be deleted, and questions in history, where they can be searched.
 */
const SHOWN = 3;

/** `abhishek` from an email local part reads better with a capital. */
const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
