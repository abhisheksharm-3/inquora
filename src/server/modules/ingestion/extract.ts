import { chunkProse, chunkSheet, chunkSlides, chunkTranscript, type Chunk } from "@/core/chunking";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";

/** Recursive character splitting at 1000 with 200 of overlap, per the design. */
const PROSE = { size: 1000, overlap: 200 };

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

    case "slides": {
      if (!source.slides?.length) {
        return err(AppError.badRequest("that presentation has no readable text"));
      }

      return ok(chunkSlides(source.slides));
    }

    case "video": {
      if (!source.transcript?.length) {
        return err(AppError.badRequest("no subtitles or transcript could be read"));
      }

      return ok(chunkTranscript(source.transcript, { windowSeconds: 60 }));
    }

    case "github": {
      // A repository arrives already chunked, because where to cut code depends
      // on the file it came from.
      if (!source.chunks?.length) {
        return err(AppError.badRequest("that repository holds no files this can index"));
      }

      return ok(source.chunks);
    }

    default: {
      const text = source.text?.trim();
      if (!text) return err(AppError.badRequest("no text could be read from that document"));

      const chunks = chunkProse(text, PROSE);

      return chunks.length > 0 ? ok(chunks) : err(AppError.badRequest("that document is empty"));
    }
  }
};
import type { Source } from "./ingestion.types";

export type { Source } from "./ingestion.types";
