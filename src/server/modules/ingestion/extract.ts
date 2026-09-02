import {
  PROSE_OVERLAP,
  PROSE_SIZE,
  SHEET_ROWS_PER_CHUNK,
  TRANSCRIPT_WINDOW_SECONDS,
} from "@/core/chunking/chunking.constants";
import type { Chunk } from "@/core/chunking/chunking.types";
import { chunkProse, chunkSheet, chunkSlides, chunkTranscript } from "@/core/chunking/prose";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import type { Source } from "./ingestion.types";

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
        for (const chunk of chunkSheet(sheet, { rowsPerChunk: SHEET_ROWS_PER_CHUNK })) {
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

      return ok(chunkTranscript(source.transcript, { windowSeconds: TRANSCRIPT_WINDOW_SECONDS }));
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

      const chunks = chunkProse(text, { size: PROSE_SIZE, overlap: PROSE_OVERLAP });

      return chunks.length > 0 ? ok(chunks) : err(AppError.badRequest("that document is empty"));
    }
  }
};
