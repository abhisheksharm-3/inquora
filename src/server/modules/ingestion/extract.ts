import { chunkProse, chunkSheet, chunkTranscript, type Chunk } from "@/core/chunking";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

/** Recursive character splitting at 1000 with 200 of overlap, per the design. */
const PROSE = { size: 1000, overlap: 200 };

export interface Source {
  kind: "pdf" | "doc" | "sheet" | "slides" | "image" | "video" | "github" | "web";
  /** Extracted text, for anything that reduces to prose. */
  text?: string;
  sheets?: { name: string; header: string[]; rows: string[][] }[];
  transcript?: { start: number; text: string }[];
}

/**
 * Turns extracted content into chunks, choosing the strategy by kind.
 *
 * Extraction itself — reading a PDF, calling the Space for subtitles — stays
 * outside this function, so the rule about how each kind is split is testable
 * without a file or a network.
 */
export const chunkSource = (source: Source): Result<Chunk[], AppError> => {
  switch (source.kind) {
    case "sheet": {
      if (!source.sheets?.length) return err(AppError.badRequest("that spreadsheet has no sheets"));

      // Chunk indexes are continuous across sheets, because chunk_index is unique
      // per document and the reader wants one sequence.
      const chunks: Chunk[] = [];

      for (const sheet of source.sheets) {
        for (const chunk of chunkSheet(sheet, { rowsPerChunk: 40 })) {
          chunks.push({ ...chunk, index: chunks.length });
        }
      }

      return chunks.length > 0 ? ok(chunks) : err(AppError.badRequest("that spreadsheet is empty"));
    }

    case "video": {
      if (!source.transcript?.length) {
        return err(AppError.badRequest("no subtitles or transcript could be read"));
      }

      return ok(chunkTranscript(source.transcript, { windowSeconds: 60 }));
    }

    default: {
      const text = source.text?.trim();
      if (!text) return err(AppError.badRequest("no text could be read from that document"));

      const chunks = chunkProse(text, PROSE);

      return chunks.length > 0 ? ok(chunks) : err(AppError.badRequest("that document is empty"));
    }
  }
};
