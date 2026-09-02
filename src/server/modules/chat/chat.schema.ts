import { z } from "zod";

/**
 * Identifiers are validated with z.guid() rather than z.uuid(). Zod's uuid check
 * enforces the RFC 9562 version and variant bits, while Postgres's uuid type
 * accepts any well-formed hex layout — so uuid() would reject values the
 * database considers valid, including every id in the pgTAP fixtures.
 */

/**
 * The chat id from the path. A path parameter is input like any other: without
 * this an unparseable segment reached Postgres, came back as `invalid input
 * syntax for type uuid`, and was reported as 502 — telling the client to retry
 * something that can never succeed.
 */
export const chatIdParam = z.guid();

/** The request body of POST /api/chats/[chatId]/messages. */
export const sendMessageRequest = z.object({
  content: z.string().min(1).max(8000),
  /** The message this one replies to. Null starts a new branch at the root. */
  parentId: z.guid().nullable().default(null),
});

export type SendMessageRequest = z.infer<typeof sendMessageRequest>;

/** What `get_chat_context` returns, narrowed to what the agent reads. */
export const chatContext = z.object({
  chat: z.object({
    id: z.guid(),
    title: z.string().nullable(),
    /** Whether this conversation may reach the open web. Off by default. */
    webSearch: z.boolean().default(false),
  }),
  documents: z.array(
    z.object({
      id: z.guid(),
      kind: z.string(),
      title: z.string(),
      status: z.string(),
      chunkCount: z.number().int(),
    }),
  ),
  messages: z.array(
    z.object({
      id: z.guid(),
      role: z.enum(["user", "assistant"]),
      parentId: z.guid().nullable(),
      parts: z.array(
        z.object({
          kind: z.string(),
          text: z.string().nullable().optional(),
          toolName: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
  memories: z.array(z.string()),
  profile: z.object({ displayName: z.string().nullable() }),
});

export type ChatContext = z.infer<typeof chatContext>;
