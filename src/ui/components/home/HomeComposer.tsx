"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { Action } from "@/ui/components/form/Action";
import { DocumentPicker } from "./DocumentPicker";

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
  chosen,
  onRemove,
  onChoose,
  value,
  onChange,
}: {
  action: (formData: FormData) => void;
  error?: string;
  /** The documents this question will read. */
  chosen: DocumentEntry[];
  onRemove: (id: string) => void;
  onChoose: (document: DocumentEntry) => void;
  /** Lifted, so clicking a suggestion fills the box rather than sending blind. */
  value: string;
  onChange: (value: string) => void;
}) => {
  const [picking, setPicking] = useState(false);
  const chosenIds = new Set(chosen.map((document) => document.id));
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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, shift-Enter is a newline, which is what every
            // writing surface has taught people to expect.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (value.trim() && chosen.length > 0) form.current?.requestSubmit();
            }
          }}
          placeholder="What does this conclude, and where does it say so?"
          className="max-h-64 min-h-[3.4rem] w-full resize-none border-0 bg-transparent p-0 font-light font-reading text-[1.3rem] text-ink leading-snug caret-mark placeholder:text-faint focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-rule border-t px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-1.5 font-record text-label text-faint">Reading</span>

          {chosen.length === 0 ? (
            <span className="font-record text-label text-faint italic">
              nothing yet — add a document to ask about
            </span>
          ) : null}

          {chosen.map((document) => (
            <span key={document.id}>
              <input type="hidden" name="document" value={document.id} />

              <button
                type="button"
                onClick={() => onRemove(document.id)}
                title={`Stop reading ${document.title}`}
                className="inline-flex h-7 max-w-[26ch] items-center gap-2 rounded-full border border-mark/40 bg-wash px-3 font-record text-label text-ink transition-colors duration-150 ease-out-quart hover:border-mark"
              >
                <span className="truncate">{document.title}</span>
                <span aria-hidden className="text-faint">
                  ×
                </span>
                <span className="sr-only">Remove</span>
              </button>
            </span>
          ))}

          {/* The way to reach a document the home screen does not list. With
              three shown and forty owned, the ninth was only reachable through
              settings, which cannot ask anything. */}
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            className="inline-flex h-7 items-center rounded-full border border-rule px-3 font-record text-label text-faint transition-colors duration-150 ease-out-quart hover:border-soft hover:text-ink"
          >
            {picking ? "Close" : "Add a document"}
          </button>
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

      {picking ? (
        <DocumentPicker chosen={chosenIds} onChoose={onChoose} onClose={() => setPicking(false)} />
      ) : null}

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
