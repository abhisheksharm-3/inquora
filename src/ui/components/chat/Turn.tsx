"use client";

import type { Turn as TurnState } from "@/ui/hooks/conversation.types";
import { Answer } from "./Answer";
import { TOOL_LABEL } from "./turn-apparatus";

/**
 * One exchange: what you asked, what came back, and what it cost.
 *
 * The transcript had none of this. A question was an unlabelled serif heading
 * and an answer was the paragraphs under it, so scrolled past the first screen
 * it read as one continuous essay with no way to tell whose words were whose or
 * where one exchange ended. There were no bubbles by design, and the design
 * relies on something else doing that work; nothing was.
 *
 * So each turn is a labelled block closed by a rule, and its footer records
 * what the answer used and how long it took — which is the apparatus idea
 * applied to the turn rather than to the column.
 */
export const Turn = ({ turn }: { turn: TurnState }) => (
  <article className="border-rule border-b py-9 first:pt-0">
    {turn.question ? (
      <header className="mb-6">
        <p className="mb-2.5 font-record text-label text-faint uppercase tracking-[0.14em]">
          You asked
        </p>
        <h2 className="max-w-[38ch] font-normal font-reading text-[1.5rem] text-ink leading-snug">
          {turn.question}
        </h2>
      </header>
    ) : null}

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
          {turn.specimens.length === 0
            ? "no sources"
            : `${turn.specimens.length} source${turn.specimens.length === 1 ? "" : "s"}`}
        </span>
        {turn.firstTokenMs ? (
          <>
            <span aria-hidden>·</span>
            <span className="tabular">{(turn.firstTokenMs / 1000).toFixed(1)}s to first word</span>
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
      </footer>
    ) : null}
  </article>
);
