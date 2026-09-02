"use client";

import { useId, useRef, useState } from "react";
import type { UploadProgress } from "@/app/(app)/app.types";
import { ACCEPTED_DESCRIPTION, ACCEPTED_EXTENSIONS } from "@/core/documents/kind";

/**
 * Adding a file. A dashed rule rather than a card, and a real `<input
 * type="file">` behind a label, so the keyboard reaches it and the browser's own
 * picker does the work.
 *
 * Dropping is the second way in, not the only one: a drop zone with no visible
 * control is unreachable without a mouse.
 */
export const UploadDrop = ({
  uploads,
  onAdd,
  onDismiss,
}: {
  uploads: UploadProgress[];
  onAdd: (files: File[]) => void;
  onDismiss: (filename: string) => void;
}) => {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <section className="mt-9">
      <h2 className="sr-only">Add a document</h2>

      <label
        htmlFor={inputId}
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
        className={`grid cursor-pointer gap-2 border border-dashed px-6 py-7 transition-colors duration-150 ease-out-quart ${
          over ? "border-mark bg-wash" : "border-rule"
        }`}
      >
        <span className="font-light font-reading text-[1.25rem] text-ink">
          Choose a file, or drop one here
        </span>
        <span className="font-record text-label text-faint tracking-[0.06em]">
          {ACCEPTED_DESCRIPTION} Up to 50MB.
        </span>
      </label>

      <input
        id={inputId}
        ref={input}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          // Cleared so choosing the same file twice fires a change both times.
          if (input.current) input.current.value = "";
        }}
        className="sr-only"
      />

      {uploads.length > 0 ? (
        <ul className="m-0 mt-5 list-none p-0">
          {uploads.map((upload) => (
            <UploadRow key={upload.filename} upload={upload} onDismiss={onDismiss} />
          ))}
        </ul>
      ) : null}
    </section>
  );
};

/**
 * One file, with a bar that shows a fraction only where one exists. A bar that
 * invents a number is worse than no bar, so the indeterminate phases get a rule
 * rather than a guess.
 */
const UploadRow = ({
  upload,
  onDismiss,
}: {
  upload: UploadProgress;
  onDismiss: (filename: string) => void;
}) => {
  const fraction = upload.fraction;
  const failed = upload.phase === "failed";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_84px_64px] items-center gap-3.5 border-rule border-b py-3">
      <span className="min-w-0 font-light font-reading text-[1rem] text-ink">
        <span className="block truncate">{upload.filename}</span>
        <span
          className={`mt-0.5 block font-record text-label ${failed ? "text-danger" : "text-faint"}`}
        >
          {upload.error ?? PHASE_LABEL[upload.phase]}
        </span>
      </span>

      <span
        role="progressbar"
        aria-label={`${upload.filename} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fraction === undefined ? undefined : Math.round(fraction * 100)}
        className="relative block h-[3px] bg-rule"
      >
        <span
          className={`absolute inset-y-0 left-0 ${failed ? "bg-faint" : "bg-mark"}`}
          style={{ width: `${(fraction ?? 1) * 100}%` }}
        />
      </span>

      {failed || upload.phase === "duplicate" ? (
        <button
          type="button"
          onClick={() => onDismiss(upload.filename)}
          className="min-h-11 text-right font-record text-label text-faint hover:text-ink"
        >
          Dismiss
        </button>
      ) : (
        <span className="text-right font-record text-label text-soft tabular">
          {fraction === undefined ? "" : `${Math.round(fraction * 100)}%`}
        </span>
      )}
    </li>
  );
};

const PHASE_LABEL: Record<UploadProgress["phase"], string> = {
  hashing: "reading the file",
  uploading: "uploading",
  queued: "queued for indexing",
  indexing: "indexing",
  ready: "ready",
  failed: "could not be added",
  duplicate: "already indexed, nothing to upload",
};
