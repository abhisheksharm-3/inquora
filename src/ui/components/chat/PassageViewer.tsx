"use client";

import type { PassageInContext } from "@/core/workspace/workspace.types";

/**
 * Surface 07. Following a citation swaps the reading column and leaves the
 * apparatus exactly where it was, which is why the layout never needs a third
 * column. One action returns.
 *
 * The cited passage is marked in place rather than extracted, because the point
 * of following a citation is seeing what sits either side of it.
 */
export const PassageViewer = ({
  passage,
  specimenNumber,
  onClose,
}: {
  passage: PassageInContext;
  specimenNumber: number;
  onClose: () => void;
}) => (
  <div className="flex-1">
    <div className="mb-6 flex items-baseline justify-between gap-4 border-rule border-b pb-2.5 font-record text-label text-faint uppercase tracking-[0.11em]">
      <span className="min-w-0 truncate">
        <b className="font-medium text-soft">{passage.documentTitle}</b>
        <span className="ml-2.5 normal-case">
          passage {passage.chunkIndex + 1} of {passage.chunkCount}
        </span>
      </span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 border-mark border-b pb-0.5 text-mark hover:bg-wash"
      >
        Back to the answer
      </button>
    </div>

    <p className="mb-5 font-record text-label text-faint">
      Source <span className="text-mark tabular">{specimenNumber}</span> is marked below.
    </p>

    <div className="max-w-[var(--measure-wide)] font-light font-reading text-ink text-read">
      {passage.passages.map((entry) => (
        <p
          key={entry.chunkIndex}
          // The marked passage keeps the wash behind it rather than a border, so
          // the reading column has no coloured stripe down its side. A
          // side-stripe wider than a hairline is one of the absolute bans.
          className={
            entry.chunkIndex === passage.chunkIndex
              ? "-mx-2 mb-4 bg-wash px-2 py-1"
              : "mb-4 text-soft"
          }
        >
          {entry.content}
        </p>
      ))}
    </div>

    {passage.passages.length === 1 ? (
      <p className="font-record text-label text-faint">
        This is the whole of what was indexed here.
      </p>
    ) : null}
  </div>
);
