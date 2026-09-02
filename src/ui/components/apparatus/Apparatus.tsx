import Link from "next/link";
import type { Entry, Operation, Specimen } from "./apparatus.types";

/**
 * The apparatus column: a record of what happened and what backs it, in IBM
 * Plex Mono, telegraphic, hairline rules between groups.
 */
export const ApparatusColumn = ({
  entries,
  label = "Apparatus",
}: {
  entries: Entry[];
  label?: string;
}) => (
  <div className="font-record text-record">
    <ApparatusHead label={label} count={countEntries(entries)} />
    {entries.map((entry) =>
      entry.kind === "operation" ? (
        <OperationEntry key={`${entry.tick}-${entry.title}`} entry={entry} />
      ) : (
        <SpecimenEntry key={entry.number} entry={entry} />
      ),
    )}
  </div>
);

/** `2 notes`, `6 specimens`, `nothing yet` — the count names what is below it. */
const countEntries = (entries: Entry[]): string => {
  const specimens = entries.filter((entry) => entry.kind === "specimen").length;
  if (specimens > 0) return `${specimens} specimen${specimens === 1 ? "" : "s"}`;

  const operations = entries.length;
  if (operations > 0) return `${operations} note${operations === 1 ? "" : "s"}`;

  return "nothing yet";
};

export const ApparatusHead = ({ label, count }: { label: string; count: string }) => (
  <div className="mb-5 flex items-baseline justify-between border-rule border-b pb-2 text-label text-faint uppercase tracking-[0.14em]">
    <span>{label}</span>
    <span>{count}</span>
  </div>
);

/** Something that ran. */
const OperationEntry = ({ entry }: { entry: Operation }) => (
  <div className="mb-4 grid grid-cols-[26px_minmax(0,1fr)] gap-3 text-soft">
    <span className="pt-0.5 text-label text-faint tabular">{entry.tick}</span>
    <span>
      <b className="font-medium text-ink">{entry.title}</b>
      {entry.detail ? <span className="block text-faint">{entry.detail}</span> : null}
      {entry.durationMs === undefined ? null : (
        <data className="block text-faint" value={String(entry.durationMs)}>
          {formatDuration(entry.durationMs)}
        </data>
      )}
    </span>
  </div>
);

/**
 * Something cited. The number is the only connective tissue between an
 * assertion and the thing that backs it, so it is a link whenever the passage
 * can be reached, and a plain box when it cannot.
 */
const SpecimenEntry = ({ entry }: { entry: Specimen }) => {
  const number = (
    <span className="grid size-[22px] place-items-center rounded-hair border border-mark font-semibold text-label text-mark tabular">
      {entry.number}
    </span>
  );

  return (
    <div id={`specimen-${entry.number}`} className="mb-5 grid grid-cols-[26px_minmax(0,1fr)] gap-3">
      {entry.href ? (
        <Link href={entry.href} aria-label={`Open the passage behind ${entry.number}`}>
          {number}
        </Link>
      ) : (
        number
      )}
      <div>
        <p className="mb-1.5 flex flex-wrap gap-2 text-label text-faint">
          {entry.source.map((part, index) => (
            <span key={part} className={index === 0 ? "font-medium text-soft" : undefined}>
              {part}
            </span>
          ))}
        </p>
        <p className="m-0 font-light font-reading text-[0.87rem] text-ink italic leading-relaxed">
          {renderMarked(entry.passage, entry.marked)}
        </p>
      </div>
    </div>
  );
};

/**
 * The matched span, marked in place. Split rather than replaced with markup, so
 * a passage that happens to contain angle brackets stays text.
 */
const renderMarked = (passage: string, marked?: string) => {
  if (!marked) return passage;

  const at = passage.indexOf(marked);
  if (at === -1) return passage;

  return (
    <>
      {passage.slice(0, at)}
      <mark className="bg-wash px-0.5 text-ink not-italic">{marked}</mark>
      {passage.slice(at + marked.length)}
    </>
  );
};

/** `840ms`, `3.8s`. A duration is read at a glance, so it gets one unit. */
const formatDuration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
