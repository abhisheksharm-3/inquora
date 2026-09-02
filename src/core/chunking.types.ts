export interface Chunk {
  index: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ProseOptions {
  size: number;
  overlap: number;
}

export interface Sheet {
  name: string;
  header: string[];
  rows: string[][];
}

export interface TranscriptLine {
  start: number;
  text: string;
}

/** One file of a repository, as the code chunker reads it. */
export interface CodeFile {
  path: string;
  language: string;
  content: string;
}
