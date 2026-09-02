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
}: {
  chrome: React.ReactNode;
  chat: ChatDetail;
  /** The passage being read, when a citation has been followed. */
  following?: { passage: PassageInContext; specimenNumber: number };
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

  const entries = turnEntries(turns);

  return (
    <div className="grid min-h-dvh grid-cols-1 content-start wide:h-dvh wide:grid-cols-[minmax(0,1fr)_var(--apparatus)] wide:grid-rows-[auto_minmax(0,1fr)]">
      {chrome}

      <main className="flex min-w-0 flex-col px-6 pt-6 pb-2 wide:overflow-y-auto wide:px-9">
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
          <div className="flex-1">
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
      </main>

      <aside className="border-rule border-t px-6 py-7 wide:overflow-y-auto wide:border-t-0 wide:border-l wide:bg-panel">
        <ApparatusColumn entries={entries} label="Apparatus" />
      </aside>
    </div>
  );
};
