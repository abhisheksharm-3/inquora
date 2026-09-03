"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ChatDetail, PassageInContext } from "@/core/workspace/workspace.types";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import { useConversation } from "@/ui/hooks/useConversation";
import { Answer } from "./Answer";
import { Composer } from "./Composer";
import { Openers } from "./Openers";
import { PassageViewer } from "./PassageViewer";
import { ScopeBar } from "./ScopeBar";
import { turnEntries } from "./turn-apparatus";

/**
 * Surfaces 05 and 06: the empty conversation and the conversation in progress.
 * The same surface, because the empty case is what it looks like before the
 * first question rather than a different screen.
 *
 * Substance left, apparatus right. The question is set large in the serif, the
 * answer under it at reading weight, and nothing is a bubble.
 */
export const ChatSurface = ({
  chrome,
  chat,
  following,
  initialQuestion,
}: {
  chrome: React.ReactNode;
  chat: ChatDetail;
  /** The passage being read, when a citation has been followed. */
  following?: { passage: PassageInContext; specimenNumber: number };
  /** Asked on the home screen, and sent as soon as this opens. */
  initialQuestion?: string;
}) => {
  const { turns, send, stop, streaming } = useConversation(chat);
  const tail = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Scrolled by the growing content rather than on a timer. `block: "end"`
  // keeps the newest line just above the composer instead of centring it.
  useEffect(() => {
    if (turns.length === 0 || following) return;

    tail.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, following]);

  // Sent once. A ref rather than a state flag, because a second render must not
  // be able to ask the same question twice, and the request is idempotent on the
  // server anyway.
  const asked = useRef(false);

  useEffect(() => {
    if (!initialQuestion || asked.current || chat.messages.length > 0) return;

    asked.current = true;
    send(initialQuestion);

    // The question is dropped from the address bar once it has been asked, so a
    // reload does not read as a fresh one and the URL stops carrying what
    // somebody typed.
    window.history.replaceState(null, "", window.location.pathname);
  }, [initialQuestion, chat.messages.length, send]);

  const entries = turnEntries(turns);

  return (
    /*
     * A fixed frame on a wide screen, an ordinary page on a phone.
     *
     * Explicit rows were declared at every width, and there are three children,
     * so on one column the sources landed in an implicit third row that the
     * `h-dvh` container had no height for: the page could not scroll and the
     * panel was unreachable. The frame is now `wide:` only, and below that the
     * page scrolls the way a page does, with the composer sticky at the bottom
     * so it stays in reach.
     */
    <div className="grid grid-cols-1 wide:h-dvh wide:grid-cols-[minmax(0,1fr)_var(--apparatus)] wide:grid-rows-[auto_minmax(0,1fr)]">
      {chrome}

      <main className="flex min-w-0 flex-col px-6 pt-6 wide:min-h-0 wide:px-10">
        {/* The reading column is where the text lives; 74 characters is how
            wide the text is. Left to fill the column, an answer at its measure
            hugged the left edge of 1500px with the rest empty, which is what
            made a wide screen look broken. */}
        <div className="mx-auto flex w-full max-w-[74ch] min-w-0 flex-1 flex-col wide:min-h-0">
          <ScopeBar chat={chat} />

          {following ? (
            <PassageViewer
              passage={following.passage}
              specimenNumber={following.specimenNumber}
              onClose={() => router.back()}
            />
          ) : turns.length === 0 ? (
            <Openers documents={chat.documents} onPick={send} />
          ) : (
            <div className="flex-1 wide:min-h-0 wide:overflow-y-auto wide:pr-2">
              {turns.map((turn) => (
                <article key={turn.id} className="mb-8">
                  {turn.question ? (
                    <h2 className="mb-7 max-w-[25ch] font-normal font-reading text-ask after:mt-5 after:block after:h-px after:w-[30px] after:bg-mark">
                      {turn.question}
                    </h2>
                  ) : null}

                  {turn.answer ? (
                    <Answer text={turn.answer} specimens={turn.specimens} />
                  ) : turn.status === "streaming" ? (
                    <p className="font-record text-label text-faint" aria-live="polite">
                      Searching
                    </p>
                  ) : null}

                  {/* Beside the thing that failed, never written into the
                    transcript as something the assistant said. */}
                  {turn.status === "failed" ? (
                    <p role="alert" className="mt-3 font-record text-label text-danger">
                      {turn.error}
                    </p>
                  ) : null}
                </article>
              ))}
              <div ref={tail} />
            </div>
          )}

          {/* No composer while a document is open: the reading column is the
            document, and asking belongs to the answer you came from. */}
          {following ? null : (
            <Composer
              onSend={send}
              onStop={stop}
              streaming={streaming}
              disabled={chat.documents.length === 0}
              placeholder={
                chat.documents.length === 0
                  ? "Add a document to this conversation first"
                  : "Ask something about what is attached"
              }
            />
          )}
        </div>
      </main>

      <aside className="border-rule border-t px-6 py-7 wide:min-h-0 wide:overflow-y-auto wide:border-t-0 wide:border-l wide:bg-panel">
        <ApparatusColumn entries={entries} label="Sources and steps" />
      </aside>
    </div>
  );
};
