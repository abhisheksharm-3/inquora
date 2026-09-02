/**
 * What the signed-in surfaces read: the register of documents, the list of
 * conversations, and one conversation in full.
 *
 * These live in core rather than in the workspace module because they are the
 * shapes that cross between the server and the interface. A component reaching
 * into `server/modules` for a type is a boundary violation the linter catches,
 * and it is the right thing to catch: a view shape belongs where both sides may
 * read it.
 */

import type { Database } from "@/core/database.types";
import type { DocumentKind } from "@/core/documents/kind";

type Tables = Database["public"]["Tables"];
export type ProcessingStatus = Database["public"]["Enums"]["processing_status"];

/** A document as the register lists it: kind, name, size and readiness on one line. */
export type DocumentEntry = {
  id: string;
  title: string;
  kind: DocumentKind;
  status: ProcessingStatus;
  byteSize: number | null;
  chunkCount: number;
  /** Written before embedding starts, so progress is a fraction rather than a spinner. */
  expectedChunks: number | null;
  error: string | null;
  createdAt: string;
  indexedAt: string | null;
};

/** A conversation as the history lists it. */
export type ChatEntry = {
  id: string;
  title: string | null;
  updatedAt: string;
  webSearch: boolean;
  /** The documents in scope, so a list entry says what the conversation is about. */
  documents: { id: string; title: string; enabled: boolean }[];
  messageCount: number;
};

/**
 * A cited passage, with enough of the chunk to render it: the apparatus shows
 * the source line and the passage itself, so a chunk id alone would mean a
 * second read per citation.
 */
export type CitedPassage = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  /** The passage's position inside its own document, for the source line. */
  chunkIndex: number;
  content: string;
};

/**
 * A cited passage with the number the reader sees: the turn's citation order,
 * matching the `[n]` mark in the text. That mark is the only connective tissue
 * between an assertion and the thing that backs it.
 */
export type Specimen = CitedPassage & { number: number };

/** One part of one message, in the order it was written. */
export type MessagePart = {
  id: string;
  kind: Tables["message_parts"]["Row"]["kind"];
  text: string | null;
  chunkId: string | null;
  toolName: string | null;
  toolArgs: unknown;
  toolResult: unknown;
  /** Set on a `source` part, which is the only kind that carries a chunk. */
  passage: CitedPassage | null;
};

export type Message = {
  id: string;
  role: Tables["messages"]["Row"]["role"];
  parentId: string | null;
  createdAt: string;
  latencyMs: number | null;
  retrievalMs: number | null;
  model: string | null;
  parts: MessagePart[];
};

/** Everything one conversation surface needs, in one round trip. */
export type ChatDetail = {
  id: string;
  title: string | null;
  webSearch: boolean;
  documents: DocumentEntry[];
  scope: Record<string, boolean>;
  messages: Message[];
};

/**
 * A passage in its context, for the surface that opens when a citation is
 * followed: the passages either side of it, with the cited one marked in place.
 */
export type PassageInContext = {
  documentId: string;
  documentTitle: string;
  /** The cited passage's own index, which is what gets marked. */
  chunkIndex: number;
  /** How many passages the document has, so the viewer can say where you are. */
  chunkCount: number;
  passages: { chunkIndex: number; content: string }[];
};

/** What this account has actually used, for the settings surface. */
export type AccountUsage = {
  documents: number;
  /** Bytes across every document, for the one number a file list cannot total. */
  bytes: number;
  chats: number;
  messages: number;
  chunks: number;
  tokensIn: number;
  tokensOut: number;
};
