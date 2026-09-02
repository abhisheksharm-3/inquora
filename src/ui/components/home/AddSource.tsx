"use client";

import { useActionState, useId, useRef, useState } from "react";
import { addLink } from "@/app/(app)/actions";
import { type ActionState, emptyActionState, type UploadProgress } from "@/app/(app)/app.types";
import { ACCEPTED_DESCRIPTION, ACCEPTED_EXTENSIONS } from "@/core/documents/kind";

/**
 * One place to add anything: a file, or a link to a repository, a video or a
 * web page.
 *
 * The links are the gap this closes. The extractor has read all three since the
 * backend was built — a YouTube video as its transcript, a repository as an
 * archive of its files, a page as its text — and the interface offered none of
 * them, so the only way in was the file picker. It also advertised audio and
 * video as file types, which would have been accepted by the picker and then
 * failed in the worker, because a video needs a URL rather than bytes.
 */
export const AddSource = ({
  uploads,
  onAdd,
  onDismiss,
}: {
  uploads: UploadProgress[];
  onAdd: (files: File[]) => void;
  onDismiss: (filename: string) => void;
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const [over, setOver] = useState(false);
  const [state, submitLink] = useActionState<ActionState, FormData>(addLink, emptyActionState);

  return (
    <div>
      {/* Dropping is a pointer-only convenience, not the way in: the file
          input's label beside it is a real control that the keyboard reaches,
          and the link field is a text input. A role on this box would announce
          an interactive element that a keyboard cannot operate, which is worse
          than none. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag target with a keyboard equivalent alongside it */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onAdd(Array.from(event.dataTransfer.files));
        }}
        className={`border-rule border-y px-1 py-4 transition-colors duration-150 ease-out-quart ${
          over ? "border-mark bg-wash" : ""
        }`}
      >
        <form action={submitLink}>
          <label htmlFor="url" className="sr-only">
            Paste a link to add
          </label>

          {/* The input and its button on one row, the button bordered. It was
              an underlined word sitting on the input's baseline, which is why
              it read as floating: an underline is what a link wears, and this
              is the control that does the thing. */}
          <div className="flex items-center gap-3">
            <input
              id="url"
              name="url"
              type="url"
              inputMode="url"
              placeholder="A GitHub repository, a YouTube video, or any web page"
              className="h-10 w-full border-0 border-rule border-b bg-transparent px-0 font-light font-reading text-[1.02rem] text-ink caret-mark placeholder:text-faint focus-visible:border-mark focus-visible:outline-none"
            />
            <button
              type="submit"
              className="flex h-10 shrink-0 items-center whitespace-nowrap rounded-hair border border-mark px-4 font-record text-label text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash"
            >
              Add
            </button>
          </div>
        </form>

        <p className="mt-4 border-rule border-t pt-4 font-record text-label text-faint">
          <label
            htmlFor={fileId}
            className="cursor-pointer border-rule border-b pb-0.5 text-soft hover:text-ink"
          >
            Or choose a file
          </label>
          <span className="ml-3 hidden sm:inline">
            — you can also drop one anywhere on this box.
          </span>
        </p>
      </div>

      <p className="mt-3 mb-6 font-record text-label text-faint">
        {ACCEPTED_DESCRIPTION} Up to 50MB. Or a GitHub repository, a YouTube video, or a web page.
      </p>

      <input
        id={fileId}
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          // Cleared so choosing the same file twice fires a change both times.
          if (fileInput.current) fileInput.current.value = "";
        }}
        className="sr-only"
      />

      {state.error ? (
        <p role="alert" className="mt-2.5 font-record text-label text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="mt-2.5 font-record text-label text-soft">
          {state.message}
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="m-0 mt-4 list-none p-0">
          {uploads.map((upload) => (
            <li
              key={upload.filename}
              className="grid grid-cols-[minmax(0,1fr)_84px_64px] items-center gap-3.5 border-rule border-b py-2.5"
            >
              <span className="min-w-0 font-light font-reading text-[0.98rem] text-ink">
                <span className="block truncate">{upload.filename}</span>
                <span
                  className={`mt-0.5 block font-record text-label ${
                    upload.phase === "failed" ? "text-danger" : "text-faint"
                  }`}
                >
                  {upload.error ?? PHASE_LABEL[upload.phase]}
                </span>
              </span>

              <span
                role="progressbar"
                aria-label={`${upload.filename} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  upload.fraction === undefined ? undefined : Math.round(upload.fraction * 100)
                }
                className="relative block h-[3px] bg-rule"
              >
                <span
                  className={`absolute inset-y-0 left-0 ${
                    upload.phase === "failed" ? "bg-faint" : "bg-mark"
                  }`}
                  style={{ width: `${(upload.fraction ?? 1) * 100}%` }}
                />
              </span>

              {upload.phase === "failed" || upload.phase === "duplicate" ? (
                <button
                  type="button"
                  onClick={() => onDismiss(upload.filename)}
                  className="text-right font-record text-label text-faint hover:text-ink"
                >
                  Dismiss
                </button>
              ) : (
                <span className="text-right font-record text-label text-soft tabular">
                  {upload.fraction === undefined ? "" : `${Math.round(upload.fraction * 100)}%`}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const PHASE_LABEL: Record<UploadProgress["phase"], string> = {
  hashing: "reading the file",
  uploading: "uploading",
  queued: "queued for reading",
  indexing: "reading it",
  ready: "ready",
  failed: "could not be added",
  duplicate: "already added, nothing to upload",
};
