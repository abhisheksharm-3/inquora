/** A heading in a prose document, with where it starts. */
export interface OutlineHeading {
  level: number;
  title: string;
  /** Character offset, so a reader can be sent to the section. */
  at: number;
}

/** A sheet in a workbook, as the outline describes it. */
export interface OutlineSheet {
  name: string;
  columns: string[];
  rows: number;
}

/** A file in a repository. */
export interface OutlineFile {
  path: string;
  lines: number;
}

export interface Outline {
  headings?: OutlineHeading[];
  sheets?: OutlineSheet[];
  files?: OutlineFile[];
  /** Total length in characters, so the model knows what it is dealing with. */
  characters?: number;
}
