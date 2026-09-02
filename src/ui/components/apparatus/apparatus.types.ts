/**
 * The two entry kinds the apparatus carries. They interleave chronologically, so
 * the column reads as what happened as well as what backs it.
 */

/** Something that ran: timestamped, with a duration. */
export type Operation = {
  kind: "operation";
  /** The gutter mark. A tick for an op, so `01` or `14:22`. */
  tick: string;
  /** What ran, in telegraphic voice: `searched 2 documents`. */
  title: string;
  /** The arguments or the result, one line, dimmer than the title. */
  detail?: string;
  /** Milliseconds, rendered as a duration when present. */
  durationMs?: number;
};

/** Something cited: numbered, with a source line and the passage itself. */
export type Specimen = {
  kind: "specimen";
  /** The specimen number. The only connective tissue to the text. */
  number: number;
  /** Where it came from: title, page, line range. */
  source: string[];
  /** The passage, set in italic serif because it is read rather than recorded. */
  passage: string;
  /** The span of the passage that was matched, marked in place. */
  marked?: string;
  /** Where following this specimen leads. Omitted while a viewer does not exist. */
  href?: string;
};

export type Entry = Operation | Specimen;
