"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { Action } from "@/ui/components/form/Action";

/**
 * The question, on the home screen, with the documents it will read shown as
 * chips underneath it.
 *
 * This is the thing that was missing. Asking used to take three screens: pick
 * documents, press a button, land in an empty conversation, then type. Here you
 * type and press Enter, and the conversation opens already answering.
 *
 * Everything ready is in scope by default and a chip turns it off, because
 * "which of my documents should this read" is a question almost nobody has on
 * the way in, and the ones who do have it can answer it in one click.
 */
export const HomeComposer = ({
  action,
  error,
  documents,
  excluded,
  onToggle,
  inScopeCount,
}: {
  action: (formData: FormData) => void;
  error?: string;
  documents: DocumentEntry[];
  excluded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  inScopeCount: number;
}) => {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);

  // Grown from its content in a layout effect, so it is measured before paint
  // and the line never jumps.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;

    element.style.height = "auto";
    if (value) element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <form ref={form} action={action} className="border border-rule">
      {/* No decorative caret bar. A textarea already draws a caret, and a
          2px oxide rule floating beside the placeholder read as a rendering
          fault rather than as a flourish. */}
      <div className="px-5 pt-5 pb-4">
        <label className="sr-only" htmlFor="question">
          Your question
        </label>
        <textarea
          id="question"
          name="question"
          ref={field}
          rows={2}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, shift-Enter is a newline, which is what every
            // writing surface has taught people to expect.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (value.trim() && inScopeCount > 0) form.current?.requestSubmit();
            }
          }}
          placeholder="Ask anything about what you have added"
          className="max-h-64 min-h-[3.4rem] w-full resize-none border-0 bg-transparent p-0 font-light font-reading text-[1.3rem] text-ink leading-snug caret-mark placeholder:text-faint focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-rule border-t px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-1.5 font-record text-label text-faint">Reading</span>

          {documents.map((document) => {
            const on = !excluded.has(document.id);

            return (
              <span key={document.id}>
                {/* A hidden input per document in scope, so the action receives
                    exactly what the chips show. */}
                {on ? <input type="hidden" name="document" value={document.id} /> : null}

                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(document.id)}
                  title={on ? `Stop reading ${document.title}` : `Read ${document.title} too`}
                  className={`inline-flex h-7 max-w-[26ch] items-center gap-1.5 rounded-full border px-3 font-record text-label transition-colors duration-150 ease-out-quart ${
                    on
                      ? "border-mark/40 bg-wash text-ink"
                      : "border-rule text-faint line-through hover:text-soft"
                  }`}
                >
                  <span className="truncate">{document.title}</span>
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {value.trim() ? (
            <span className="hidden font-record text-label text-faint sm:inline">Enter to ask</span>
          ) : null}
          <Action className="min-h-9 px-5" pendingLabel="Asking">
            Ask
          </Action>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-rule border-t px-5 py-3 font-record text-label text-danger"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
};
