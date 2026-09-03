import Link from "next/link";
import type { Entry, Operation, Specimen } from "./apparatus.types";

/**
 * The apparatus column: a record of what happened and what backs it, in IBM
 * Plex Mono, telegraphic, hairline rules between groups.
 */
export const ApparatusColumn = ({
  entries,
  label = "Sources",
}: {
  entries: Entry[];
  label?: string;
}) => (
  <div className="font-record text-record">
    <ApparatusHead label={label} count={countEntries(entries)} />
    {entries.map((entry) =>
      entry.kind === "operation" ? (
        <OperationEntry key={entry.id} entry={entry} />
      ) : (
        <SpecimenEntry key={entry.id} entry={entry} />
      ),
    )}
  </div>
);

/** `2 notes`, `6 specimens`, `nothing yet` — the count names what is below it. */
const countEntries = (entries: Entry[]): string => {
  const specimens = entries.filter((entry) => entry.kind === "specimen").length;
  if (specimens > 0) return `${specimens} source${specimens === 1 ? "" : "s"}`;

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
    <div id={`specimen-${entry.id}`} className="mb-5 grid grid-cols-[26px_minmax(0,1fr)] gap-3">
      {entry.href ? (
        <Link
          href={entry.href}
          scroll={false}
          aria-label={`Open the passage behind ${entry.number}`}
        >
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
        <Passage passage={entry.passage} marked={entry.marked} />
      </div>
    </div>
  );
};

/** How much of a passage is shown before it has to be asked for. */
const SHOWN_CHARACTERS = 260;

/**
 * A passage, trimmed to something readable, expandable in place.
 *
 * A cited chunk is a thousand characters of raw extracted text, and the column
 * printed all of it for every source. Eighteen sources became a wall of italic
 * that buried the answer beside it. `<details>` rather than state: it is one
 * disclosure, the browser already has one, and it keeps working before any
 * JavaScript arrives.
 */
const Passage = ({ passage, marked }: { passage: string; marked?: string }) => {
  const collapsed = passage.trim().replace(/\s+/g, " ");

  if (collapsed.length <= SHOWN_CHARACTERS) {
    return (
      <p className="m-0 font-light font-reading text-[0.87rem] text-ink italic leading-relaxed">
        {renderMarked(collapsed, marked)}
      </p>
    );
  }

  // Cut at a word rather than mid-word.
  const cut = collapsed.lastIndexOf(" ", SHOWN_CHARACTERS);
  const head = collapsed.slice(0, cut > 0 ? cut : SHOWN_CHARACTERS);

  return (
    <details className="group m-0">
      <summary className="list-none font-light font-reading text-[0.87rem] text-ink italic leading-relaxed marker:hidden">
        <span className="group-open:hidden">
          {renderMarked(head, marked)}
          <span aria-hidden>… </span>
          <span className="whitespace-nowrap font-record text-label text-mark not-italic">
            more
          </span>
        </span>
        <span className="hidden group-open:inline">
          {renderMarked(collapsed, marked)}
          <span className="ml-2 whitespace-nowrap font-record text-label text-faint not-italic">
            less
          </span>
        </span>
      </summary>
    </details>
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
