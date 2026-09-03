"use client";

import { ComposerPrimitive } from "@assistant-ui/react";

/**
 * The question box.
 *
 * It was a bare line above a hairline, with "Enter to send" floating in the
 * middle of an empty row and the send control at the far right, so the thing
 * you type into did not look like a thing you type into and nothing in the row
 * belonged to anything else in it.
 *
 * It is the same object as the one on the home screen now: a bordered box, the
 * text at reading size, and one footer row carrying what the question will read
 * on the left and the send control on the right. Two screens that do the same
 * thing should not have two shapes for it.
 *
 * The text, the growing textarea and the Enter handling are assistant-ui's:
 * `ComposerPrimitive.Input` is a textarea that sizes to its content, sends on
 * Enter and keeps a newline on shift-Enter, and `Send` disables itself when
 * there is nothing to send. Stopping stays a prop, because the run belongs to
 * the hook that opened the stream.
 */
export const Composer = ({
  onStop,
  streaming,
  scope,
  placeholder = "Ask something about what is attached",
}: {
  onStop: () => void;
  streaming: boolean;
  /** What this question will read, on the same row as the send control. */
  scope?: React.ReactNode;
  placeholder?: string;
}) => (
  <div className="sticky bottom-0 shrink-0 bg-ground pt-3 pb-5 wide:static">
    <ComposerPrimitive.Root className="border border-rule focus-within:border-soft">
      <div className="px-5 pt-4 pb-3">
        <label className="sr-only" htmlFor="question">
          Your question
        </label>
        <ComposerPrimitive.Input
          id="question"
          rows={1}
          maxRows={8}
          placeholder={placeholder}
          className="w-full resize-none border-0 bg-transparent p-0 font-light font-reading text-[1.15rem] text-ink leading-snug caret-mark placeholder:text-faint focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-rule border-t px-5 py-3">
        {scope ?? <span />}

        <div className="flex shrink-0 items-center gap-4">
          {streaming ? (
            <>
              <span className="font-record text-label text-faint">Answering</span>
              <button
                type="button"
                onClick={onStop}
                className="flex h-9 items-center rounded-hair border border-rule px-3.5 font-record text-label text-soft uppercase tracking-[0.12em] hover:border-soft hover:text-ink"
              >
                Stop
              </button>
            </>
          ) : (
            <ComposerPrimitive.Send className="flex h-9 items-center rounded-hair border border-mark px-4 font-record text-label text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash disabled:border-rule disabled:text-faint">
              Ask
            </ComposerPrimitive.Send>
          )}
        </div>
      </div>
    </ComposerPrimitive.Root>
  </div>
);
