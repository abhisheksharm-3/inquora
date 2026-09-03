"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * A line of writing with an oxide caret, not a bordered box. One hairline above
 * it, the serif at reading weight, and no send button until there is something
 * to send.
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
  placeholder = "Ask something about what is attached",
}: {
  onSend: (question: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  // Height set from the content rather than from a row count, in a layout
  // effect so it is measured before paint and the line never jumps.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;

    element.style.height = "auto";
    // An empty field is one row. Measuring scrollHeight on an empty textarea
    // returns its padded minimum, which is taller than the line the design asks
    // for.
    if (value) element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  const send = () => {
    if (!value.trim() || streaming) return;

    onSend(value);
    setValue("");
  };

  return (
    <div className="shrink-0 border-rule border-t pt-4 pb-6">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-1.5 h-[19px] w-[1.5px] shrink-0 bg-mark" />
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
          className="max-h-56 min-h-[26px] w-full resize-none border-0 bg-transparent p-0 font-light font-reading text-[1.05rem] text-ink caret-mark placeholder:text-faint focus-visible:outline-none"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 pl-5">
        <p className="font-record text-label text-faint">
          {streaming ? "Answering" : value.trim() ? "Enter to send" : ""}
        </p>

        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="min-h-11 font-record text-label text-faint uppercase tracking-[0.13em] hover:text-ink"
          >
            Stop
          </button>
        ) : value.trim() ? (
          <button
            type="button"
            onClick={send}
            className="inline-flex min-h-11 items-center rounded-hair border border-mark px-3.5 py-1.5 font-record text-label text-mark uppercase tracking-[0.13em] transition-colors duration-150 ease-out-quart hover:bg-wash"
          >
            Ask
          </button>
        ) : null}
      </div>
    </div>
  );
};
