import type { DocumentEntry } from "@/core/workspace/workspace.types";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";

/**
 * What a selection actually buys you: which tools it switches on, and which stay
 * off and why.
 *
 * The answering agent decides its own tool surface from the same kinds, so this
 * describes a real consequence rather than a marketing list. When a tool is off
 * the note says which document would switch it on, because "not available" with
 * no reason is the least useful thing a screen can say.
 */
export const toolEntriesFor = (selected: DocumentEntry[]): Entry[] => {
  if (selected.length === 0) {
    return [
      {
        kind: "operation",
        tick: "◦",
        title: "Nothing selected",
        detail: "Choose a document and this column says what becomes possible.",
      },
    ];
  }

  const passages = selected.reduce((total, document) => total + document.chunkCount, 0);
  const has = (kind: DocumentEntry["kind"]) => selected.some((entry) => entry.kind === kind);

  const on: Entry[] = [
    {
      kind: "operation",
      tick: "→",
      title:
        selected.length === 1 ? "Search this document" : `Search across all ${selected.length}`,
      detail: `One query, ranked over ${passages.toLocaleString()} passages.`,
    },
    {
      kind: "operation",
      tick: "→",
      title: "Read around a hit",
      detail: "Passages either side of a match, when an answer spans a break.",
    },
  ];

  if (has("sheet")) {
    on.push({
      kind: "operation",
      tick: "→",
      title: "Query the spreadsheet",
      detail: "Rows are queryable, so figures come from cells rather than from prose about them.",
    });
  }

  if (has("github")) {
    on.push({
      kind: "operation",
      tick: "→",
      title: "Search the code",
      detail: "Grep by pattern, then read the file around the match at its real line numbers.",
    });
  }

  if (has("video")) {
    on.push({
      kind: "operation",
      tick: "→",
      title: "Read the transcript",
      detail: "Timed segments, so a citation points at the second it was said.",
    });
  }

  const off: Entry[] = [];

  if (!has("sheet")) {
    off.push({
      kind: "operation",
      tick: "◦",
      title: "Not available: query a spreadsheet",
      detail: "Add a spreadsheet to switch it on.",
    });
  }

  if (!has("github")) {
    off.push({
      kind: "operation",
      tick: "◦",
      title: "Not available: search the code",
      detail: "Add a repository to switch it on.",
    });
  }

  return [...on, ...off];
};
