"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ChatDetail, PassageInContext } from "@/core/workspace/workspace.types";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import { useChatRuntime } from "@/ui/hooks/useChatRuntime";
import { Composer } from "./Composer";
import { Openers } from "./Openers";
import { PassageViewer } from "./PassageViewer";
import { ScopeBar } from "./ScopeBar";
import { Thread } from "./Thread";
import { turnEntries } from "./turn-apparatus";

/**
 * Surfaces 05 and 06: the empty conversation and the conversation in progress.
 * The same surface, because the empty case is what it looks like before the
 * first question rather than a different screen.
 *
 * Substance left, apparatus right. The question is set large in the serif, the
 * answer under it at reading weight, and nothing is a bubble.
 *
 * The thread itself is assistant-ui, driven by an external store whose one
 * writer is `useConversation`. Everything the library renders is unstyled, so
 * the design is unchanged; what it brings is the behaviour a transcript needs
 * and did not have — a viewport that follows the answer and lets go when you
 * scroll up, copy, editing a question, and asking again.
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
  const { runtime, turns, send, streaming, stop } = useChatRuntime(chat);
  const router = useRouter();

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
        {/* Full bleed. The column is the column, and the text inside it takes
            the wider of the two measures rather than being centred in a lane of
            its own — a centred lane put a gutter on both sides of a page that
            already has a panel down one edge. */}
        {following ? (
          <div className="flex w-full min-w-0 flex-1 flex-col wide:min-h-0">
            <PassageViewer
              passage={following.passage}
              specimenNumber={following.specimenNumber}
              onClose={() => router.back()}
            />
          </div>
        ) : (
          <AssistantRuntimeProvider runtime={runtime}>
            <Thread
              empty={<Openers documents={chat.documents} onPick={send} />}
              composer={
                <Composer
                  onStop={stop}
                  streaming={streaming}
                  scope={<ScopeBar chat={chat} />}
                  placeholder={
                    chat.documents.length === 0
                      ? "Add a document to this conversation first"
                      : "Ask something about what is attached"
                  }
                />
              }
            />
          </AssistantRuntimeProvider>
        )}
      </main>

      <aside className="border-rule border-t px-6 py-7 wide:min-h-0 wide:overflow-y-auto wide:border-t-0 wide:border-l wide:bg-panel">
        <ApparatusColumn entries={entries} label="Sources and steps" />
      </aside>
    </div>
  );
};
