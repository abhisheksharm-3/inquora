import type { Entry } from "@/ui/components/apparatus/apparatus.types";
import type { Turn } from "@/ui/hooks/conversation.types";

/**
 * One turn's apparatus: operations and specimens, interleaved in the order they
 * happened, so the column reads as what happened as well as what backs it.
 *
 * Operations come first within a turn because a search has to run before it can
 * return anything to cite. The Workbench direction lost the shape run, but its
 * idea survives here: a tool call renders as a legible operation with a real
 * timing rather than collapsing into a spinner.
 */
export const turnEntries = (turns: Turn[]): Entry[] =>
  turns.flatMap((turn) => [
    ...turn.operations.map(
      (operation): Entry => ({
        kind: "operation",
        // Scoped to the turn, because the same tool runs in several of them.
        id: `${turn.id}:${operation.name}:${operation.startedAt}`,
        tick: operation.durationMs === undefined ? "·" : "✓",
        title: TOOL_LABEL[operation.name] ?? operation.name,
        detail: operation.argument,
        durationMs: operation.durationMs,
      }),
    ),
    ...turn.specimens.map(
      (specimen): Entry => ({
        kind: "specimen",
        id: `${turn.id}:${specimen.number}`,
        number: specimen.number,
        source: [specimen.documentTitle, `passage ${specimen.chunkIndex + 1}`],
        passage: specimen.content,
        href: passageHref(specimen.chunkId, specimen.number),
      }),
    ),
    ...failureOf(turn),
  ]);

/**
 * Where following a citation goes. A URL rather than a click handler: the back
 * button becomes the "one action returns" the design asks for, the view is
 * shareable, and the apparatus stays a server component.
 */
export const passageHref = (chunkId: string, number: number) =>
  `?passage=${encodeURIComponent(chunkId)}&specimen=${number}`;

/**
 * A failure is a record of what happened, not a turn in the conversation. The
 * old system wrote errors into `messages`, so every outage became a permanent
 * line of dialogue replayed as history on the next request.
 */
const failureOf = (turn: Turn): Entry[] => {
  if (turn.status === "failed") {
    return [
      {
        kind: "operation",
        id: `${turn.id}:failed`,
        tick: "!",
        title: "The answer failed",
        detail: turn.error,
      },
    ];
  }

  if (turn.status === "aborted") {
    return [
      {
        kind: "operation",
        id: `${turn.id}:stopped`,
        tick: "·",
        title: "Stopped",
        detail: "What had been written was kept.",
      },
    ];
  }

  return [];
};

/**
 * The tool names, in the voice the apparatus uses: telegraphic, lower case.
 * Exported, because a turn that is still working says the same words.
 */
export const TOOL_LABEL: Record<string, string> = {
  search_documents: "searched the documents",
  read_chunks: "read around a hit",
  list_documents: "listed what is attached",
  query_table: "queried the spreadsheet",
  list_tables: "listed the sheets",
  grep_document: "searched the code",
  read_file: "read the file",
  document_outline: "read the structure",
  get_transcript: "read the transcript",
  remember: "remembered something",
  web_search: "searched the web",
  calculate: "calculated",
};
