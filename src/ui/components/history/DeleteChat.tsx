"use client";

import { useActionState, useState } from "react";
import { deleteChat } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";

/**
 * Deleting a conversation, which had no way in at all: the action existed and
 * nothing called it, so a question asked by mistake stayed on the history page
 * for good.
 *
 * Two clicks rather than a modal. `DESIGN.md` reaches for an inline
 * alternative before a dialog, and the confirmation is the same control saying
 * what it is about to do. The second click is a different word in a different
 * colour, so it cannot be hit by muscle memory.
 */
export const DeleteChat = ({ chatId, title }: { chatId: string; title: string }) => {
  const [state, remove] = useActionState<ActionState, FormData>(deleteChat, emptyActionState);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={remove} className="shrink-0">
      <input type="hidden" name="chatId" value={chatId} />

      {confirming ? (
        <span className="flex items-center gap-3">
          <button
            type="submit"
            className="min-h-9 whitespace-nowrap border-danger border-b pb-0.5 font-record text-label text-danger"
          >
            Delete for good
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-9 whitespace-nowrap font-record text-label text-faint hover:text-ink"
          >
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete "${title}"`}
          className="min-h-9 whitespace-nowrap font-record text-label text-faint hover:text-danger"
        >
          Delete
        </button>
      )}

      {state.error ? (
        <p role="alert" className="mt-1 font-record text-label text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
};
