/**
 * Chunking, per content kind. Pure functions over text: no I/O, no provider, so
 * every rule here is testable without a network.
 *
 * The strategies differ because the content does. Prose splits on structure,
 * spreadsheets split on rows with the header repeated, and video splits on time.
 * One recursive character splitter over everything is what destroyed columns,
 * types and row identity in the old ingestion path.
 */

export interface Chunk {
  index: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ProseOptions {
  size: number;
  overlap: number;
}

/** A markdown or setext heading, captured so a passage knows what it sits under. */
const HEADING = /^(#{1,6})\s+(.+)$/;

/**
 * Recursive character splitting for prose: paragraphs first, then sentences,
 * then words. Splitting mid-sentence is a last resort rather than the default.
 */
export const chunkProse = (text: string, { size, overlap }: ProseOptions): Chunk[] => {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [];

  const chunks: Chunk[] = [];
  let heading: string | undefined;
  let buffer = "";
  let bufferHeading: string | undefined;

  const flush = () => {
    const content = buffer.trim();
    if (!content) return;

    chunks.push({
      index: chunks.length,
      content,
      metadata: bufferHeading === undefined ? {} : { heading: bufferHeading },
    });

    // The tail of the previous chunk opens the next one, so a sentence that
    // straddles the boundary appears whole in one of them.
    buffer = overlap > 0 ? content.slice(-overlap) : "";
    bufferHeading = heading;
  };

  for (const paragraph of paragraphs) {
    const match = HEADING.exec(paragraph);

    if (match) {
      // A heading ends the previous chunk. Letting two sections share one chunk
      // means a passage retrieved for its heading carries text that belongs
      // under a different one.
      if (buffer.trim().length > 0) {
        flush();
        buffer = "";
      }

      heading = match[2].trim();
      bufferHeading = heading;
      continue;
    }

    for (const piece of splitToSize(paragraph, size)) {
      if (buffer.length > 0 && buffer.length + piece.length + 1 > size) flush();
      if (bufferHeading === undefined) bufferHeading = heading;
      buffer = buffer.length > 0 ? `${buffer} ${piece}` : piece;
    }
  }

  flush();

  return chunks;
};

/** Sentences, then words, then a hard cut. Only the last of these loses meaning. */
const splitToSize = (paragraph: string, size: number): string[] => {
  if (paragraph.length <= size) return [paragraph];

  const pieces: string[] = [];
  let current = "";

  for (const sentence of paragraph.match(/[^.!?]+[.!?]*\s*/g) ?? [paragraph]) {
    if (current.length + sentence.length > size && current.length > 0) {
      pieces.push(current.trim());
      current = "";
    }

    if (sentence.length > size) {
      for (const word of sentence.split(/\s+/)) {
        if (current.length + word.length + 1 > size && current.length > 0) {
          pieces.push(current.trim());
          current = "";
        }
        current = current.length > 0 ? `${current} ${word}` : word;
      }
      continue;
    }

    current += sentence;
  }

  if (current.trim()) pieces.push(current.trim());

  return pieces;
};

export interface Sheet {
  name: string;
  header: string[];
  rows: string[][];
}

/**
 * Row groups, with the header row repeated in every chunk.
 *
 * This is a correctness fix rather than a nicety. Without the repeat, every
 * chunk after the first is a grid of numbers with no column names, so "what was
 * Acme's stage" cannot be answered from the chunk that contains the answer.
 */
export const chunkSheet = (
  { name, header, rows }: Sheet,
  { rowsPerChunk }: { rowsPerChunk: number },
): Chunk[] => {
  if (rows.length === 0) return [];

  const chunks: Chunk[] = [];
  const headerLine = header.join(" | ");

  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    const slice = rows.slice(start, start + rowsPerChunk);

    chunks.push({
      index: chunks.length,
      content: [`Sheet: ${name}`, headerLine, ...slice.map((row) => row.join(" | "))].join("\n"),
      metadata: {
        sheet: name,
        fromRow: start,
        toRow: start + slice.length - 1,
      },
    });
  }

  return chunks;
};

export interface TranscriptLine {
  start: number;
  text: string;
}

/**
 * Time-windowed, so a citation can deep-link to the moment rather than to the
 * video. Windows are cut on the clock, not on line count, because a talking head
 * and a silent screencast produce very different line densities.
 */
export const chunkTranscript = (
  lines: TranscriptLine[],
  { windowSeconds }: { windowSeconds: number },
): Chunk[] => {
  if (lines.length === 0) return [];

  const chunks: Chunk[] = [];
  let current: TranscriptLine[] = [];
  let windowStart = lines[0].start;

  const flush = () => {
    if (current.length === 0) return;

    chunks.push({
      index: chunks.length,
      content: current.map((line) => line.text).join(" "),
      metadata: {
        startSeconds: windowStart,
        endSeconds: current.at(-1)!.start,
      },
    });

    current = [];
  };

  for (const line of lines) {
    if (current.length > 0 && line.start - windowStart >= windowSeconds) {
      flush();
      windowStart = line.start;
    }

    current.push(line);
  }

  flush();

  return chunks;
};
