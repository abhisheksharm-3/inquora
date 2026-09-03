"use client";

import {
  type AppendMessage,
  type ExternalStoreAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useMemo } from "react";
import type { ChatDetail } from "@/core/workspace/workspace.types";
import type { Turn } from "./conversation.types";
import { useConversation } from "./useConversation";

/**
 * The conversation, handed to assistant-ui.
 *
 * `useConversation` stays the only writer: it owns the SSE stream, the turn
 * that is filling in, and the abort. That is exactly the case
 * `useExternalStoreRuntime` exists for — the runtime reads a snapshot and
 * routes actions back through the adapter rather than holding state of its own.
 *
 * What the library brings that the hand-rolled transcript did not have: an
 * autoscrolling viewport that lets go when you scroll up, copy, editing a
 * question in place, regenerating an answer, and a branch picker over the
 * versions that produces. `messages.parent_id` was added in migration 0004 for
 * that last one and sat unused until this hook started sending it.
 */
export const useChatRuntime = (chat: ChatDetail) => {
  const { turns, send, regenerate, edit, stop, streaming } = useConversation(chat);

  /*
   * One turn is two messages, because a thread is what assistant-ui renders and
   * a turn is what the apparatus is grouped by. Ids are prefixed rather than
   * reusing the turn id, since both messages would otherwise answer to it.
   */
  const messages = useMemo<Entry[]>(
    () =>
      turns.flatMap((turn): Entry[] => [
        ...(turn.question ? [{ id: `u:${turn.id}`, role: "user" as const, turn }] : []),
        ...(turn.answer || turn.status === "streaming"
          ? [{ id: `a:${turn.id}`, role: "assistant" as const, turn }]
          : []),
      ]),
    [turns],
  );

  const turnAt = (index: number) => turns[index];

  const adapter: ExternalStoreAdapter<Entry> = {
    messages,
    isRunning: streaming,
    isDisabled: chat.documents.length === 0,
    convertMessage,
    unstable_capabilities: { copy: true },
    onNew: async (message) => send(textOf(message)),
    onCancel: async () => stop(),

    // The message before the one being edited, so the turn to replace is the
    // one after it. A null parent means the first question in the chat.
    onEdit: async (message) => {
      const at = message.parentId ? indexOfTurn(turns, message.parentId) + 1 : 0;
      const target = turnAt(at);

      if (!target) {
        send(textOf(message));
        return;
      }

      edit(target.id, textOf(message));
    },

    // The parent of an answer is its own question, which is the turn to run
    // again.
    onReload: async (parentId) => {
      const at = parentId === null ? 0 : indexOfTurn(turns, parentId);
      const target = turnAt(at);

      if (target) regenerate(target.id);
    },
  };

  return { runtime: useExternalStoreRuntime(adapter), turns, send, stop, streaming };
};

/** A message as the store holds it: a turn, seen from one side. */
type Entry = { id: string; role: "user" | "assistant"; turn: Turn };

const indexOfTurn = (turns: Turn[], messageId: string) =>
  turns.findIndex((turn) => turn.id === messageId.slice(2));

/**
 * The turn travels on `metadata.custom`, so the components that render an
 * answer keep the specimens, the timings and the failure they already used
 * without a second lookup by id.
 */
const convertMessage = ({ id, role, turn }: Entry): ThreadMessageLike =>
  role === "user"
    ? { id, role, content: [{ type: "text", text: turn.question }] }
    : {
        id,
        role,
        content: [{ type: "text", text: turn.answer }],
        status: statusOf(turn),
        metadata: { custom: { turn } },
      };

const statusOf = (turn: Turn): ThreadMessageLike["status"] => {
  switch (turn.status) {
    case "streaming":
      return { type: "running" };
    case "complete":
      return { type: "complete", reason: "stop" };
    case "aborted":
      return { type: "incomplete", reason: "cancelled" };
    case "failed":
      return { type: "incomplete", reason: "error", error: turn.error ?? null };
  }
};

const textOf = (message: AppendMessage) =>
  message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
