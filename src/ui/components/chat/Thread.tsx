"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import type { Turn } from "@/ui/hooks/conversation.types";
import { Answer } from "./Answer";
import { citedNumbers } from "./citations";
import { TOOL_LABEL } from "./turn-apparatus";

/**
 * The transcript, as an assistant-ui thread.
 *
 * What was here before was a hand-rolled list with a scroll-into-view effect on
 * every render, no way to edit a question, no way to ask again, and no copy.
 * The primitives are unstyled, so the design survives intact and the behaviour
 * that is tedious to get right — a viewport that follows the answer until you
 * scroll up, an edit composer that swaps in over the message being edited,
 * buttons that disable themselves while a run is going — comes from the library.
 */
export const Thread = ({
  empty,
  composer,
}: {
  /** The openers, shown until the first question. */
  empty: React.ReactNode;
  composer: React.ReactNode;
}) => (
  <ThreadPrimitive.Root className="flex w-full min-w-0 flex-1 flex-col wide:min-h-0">
    <AuiIf condition={(state) => state.thread.isEmpty}>{empty}</AuiIf>

    <ThreadPrimitive.Viewport
      autoScroll
      className="flex-1 wide:min-h-0 wide:overflow-y-auto wide:pr-2"
    >
      <ThreadPrimitive.Messages
        components={{
          UserMessage: Question,
          UserEditComposer: EditQuestion,
          AssistantMessage: AnswerMessage,
        }}
      />
    </ThreadPrimitive.Viewport>

    {composer}
  </ThreadPrimitive.Root>
);

/** What you asked, and the offer to ask it differently. */
const Question = () => {
  const text = useAuiState((state) => textOf(state.message.parts));

  return (
    <MessagePrimitive.Root className="group pt-9 first:pt-0">
      <p className="mb-2.5 font-record text-label text-faint uppercase tracking-[0.14em]">
        You asked
      </p>
      <h2 className="max-w-[38ch] font-normal font-reading text-[1.5rem] text-ink leading-snug">
        {text}
      </h2>

      <ActionBarPrimitive.Root
        autohide="not-last"
        className="mt-3 flex items-center gap-4 opacity-0 transition-opacity duration-150 ease-out-quart focus-within:opacity-100 group-hover:opacity-100"
      >
        <ActionBarPrimitive.Edit className={ACTION}>Ask it differently</ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

/** The same question, open for rewriting. Sending it branches the chat. */
const EditQuestion = () => (
  <MessagePrimitive.Root className="pt-9 first:pt-0">
    <p className="mb-2.5 font-record text-label text-faint uppercase tracking-[0.14em]">
      Asking instead
    </p>

    <ComposerPrimitive.Root className="border border-rule focus-within:border-soft">
      <ComposerPrimitive.Input
        autoFocus
        className="w-full resize-none border-0 bg-transparent px-5 pt-4 pb-3 font-normal font-reading text-[1.4rem] text-ink leading-snug caret-mark focus-visible:outline-none"
      />

      <div className="flex items-center justify-end gap-4 border-rule border-t px-5 py-3">
        <ComposerPrimitive.Cancel className={ACTION}>Keep the original</ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send className="flex h-9 items-center rounded-hair border border-mark px-4 font-record text-label text-mark uppercase tracking-[0.12em] hover:bg-wash">
          Ask
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  </MessagePrimitive.Root>
);

/**
 * What came back, what it cost, and the two things you can do with it.
 *
 * The turn rides on the message's metadata, so the specimens, the timings and
 * the failure are read straight from the one owner of the stream rather than
 * being reassembled from message parts.
 */
const AnswerMessage = () => {
  const turn = useAuiState((state) => (state.message.metadata?.custom?.turn as Turn) ?? null);

  if (!turn) return null;

  /*
   * Cited, not retrieved.
   *
   * The footer used to report every passage a search returned, so an answer
   * resting on one passage said "12 sources". A review of the retrieval read
   * that as poor precision, and the retrieval was fine — the label was
   * counting candidates. How many were read is worth saying too, but as the
   * second number rather than the first.
   */
  const cited = citedNumbers(turn.answer);
  const supporting = turn.specimens.filter((specimen) => cited.has(specimen.number)).length;

  return (
    <MessagePrimitive.Root className="group border-rule border-b pt-6 pb-9">
      {turn.answer ? (
        <Answer text={turn.answer} specimens={turn.specimens} />
      ) : turn.status === "streaming" ? (
        <p aria-live="polite" className="font-record text-label text-faint">
          {turn.operations.length > 0
            ? (TOOL_LABEL[turn.operations.at(-1)?.name ?? ""] ?? "Working")
            : "Searching your documents"}
        </p>
      ) : null}

      {/* Beside the thing that failed, never written into the transcript as
        something the assistant said. The old system stored failures as
        assistant messages, so every outage became a permanent turn. */}
      {turn.status === "failed" ? (
        <p role="alert" className="mt-4 font-record text-record text-danger">
          {turn.error}
        </p>
      ) : null}

      {turn.answer && turn.status !== "streaming" ? (
        <footer className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-record text-label text-faint">
          <span>
            {supporting === 0
              ? "nothing cited"
              : `${supporting} source${supporting === 1 ? "" : "s"} cited`}
          </span>
          {turn.specimens.length > supporting ? (
            <>
              <span aria-hidden>·</span>
              <span>{turn.specimens.length} read</span>
            </>
          ) : null}
          {turn.firstTokenMs ? (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">
                {(turn.firstTokenMs / 1000).toFixed(1)}s to first word
              </span>
            </>
          ) : null}
          {turn.totalMs ? (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{(turn.totalMs / 1000).toFixed(1)}s in all</span>
            </>
          ) : null}
          {turn.status === "aborted" ? (
            <>
              <span aria-hidden>·</span>
              <span>stopped early, what was written was kept</span>
            </>
          ) : null}

          <ActionBarPrimitive.Root
            autohide="not-last"
            className="ml-auto flex items-center gap-4 opacity-0 transition-opacity duration-150 ease-out-quart focus-within:opacity-100 group-hover:opacity-100"
          >
            <ActionBarPrimitive.Copy className={ACTION}>Copy</ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload className={ACTION}>Ask again</ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        </footer>
      ) : null}
    </MessagePrimitive.Root>
  );
};

/** One control language for everything in the margins of a message. */
const ACTION =
  "font-record text-label text-faint uppercase tracking-[0.12em] hover:text-ink disabled:opacity-40";

const textOf = (parts: readonly { type: string; text?: string }[]) =>
  parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
