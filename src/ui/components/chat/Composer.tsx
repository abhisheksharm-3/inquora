"use client";

import { useLayoutEffect, useRef, useState } from "react";

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
 * A textarea rather than an input, because a question can be two sentences, and
 * it grows to fit rather than scrolling inside three lines. Enter sends;
 * shift-Enter is a newline, which is what every writing surface has taught
 * people to expect.
 */
export const Composer = ({
  onSend,
  onStop,
  streaming,
  disabled,
  scope,
  placeholder = "Ask something about what is attached",
}: {
  onSend: (question: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  /** What this question will read, on the same row as the send control. */
  scope?: React.ReactNode;
  placeholder?: string;
}) => {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  // Height from the content rather than a row count, in a layout effect so it
  // is measured before paint and the line never jumps.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;

    element.style.height = "auto";
    if (value) element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  const send = () => {
    if (!value.trim() || streaming) return;

    onSend(value);
    setValue("");
  };

  return (
    <div className="sticky bottom-0 shrink-0 bg-ground pt-3 pb-5 wide:static">
      <div className="border border-rule focus-within:border-soft">
        <div className="px-5 pt-4 pb-3">
          <label className="sr-only" htmlFor="question">
            Your question
          </label>
          <textarea
            id="question"
            ref={field}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            className="max-h-52 min-h-[2.2rem] w-full resize-none border-0 bg-transparent p-0 font-light font-reading text-[1.15rem] text-ink leading-snug caret-mark placeholder:text-faint focus-visible:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-rule border-t px-5 py-3">
          {scope ?? <span />}

          <div className="flex shrink-0 items-center gap-4">
            {value.trim() && !streaming ? (
              <span className="hidden font-record text-label text-faint sm:inline">
                Enter to ask
              </span>
            ) : null}

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
              <button
                type="button"
                onClick={send}
                disabled={disabled || !value.trim()}
                className="flex h-9 items-center rounded-hair border border-mark px-4 font-record text-label text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash disabled:border-rule disabled:text-faint"
              >
                Ask
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
