import type { DocumentKind } from "@/server/modules/documents/documents.schema";

/**
 * What a document kind needs the model to know, and which tools it should reach
 * for.
 *
 * A model handed eleven tools and the word "documents" searches for everything.
 * A model told "this one is a repository, here is its file tree, grep for
 * identifiers and read_file to see a whole function" behaves like somebody who
 * has used a repository before.
 */
export interface KindSpecialist {
  kind: DocumentKind;
  /** How a person would describe this kind, for the prompt. */
  label: string;
  /** The tools that answer questions about this kind well. */
  tools: string[];
  /** How to work with it, written as instructions rather than as description. */
  guidance: string;
  /** What to warn about, where this kind has a known limit. */
  caveat?: string;
}
