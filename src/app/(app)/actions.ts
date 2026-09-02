"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DASHBOARD_ROUTES } from "@/core/routes";
import { requestUploadTicket } from "@/server/modules/documents/documents.factory";
import { workspaceForRequest } from "@/server/modules/workspace/workspace.factory";
import type { ActionState, PassageState, UploadRequestInput, UploadTicketState } from "./app.types";

/**
 * The transport edge for the signed-in surfaces. Every action reads a form,
 * calls the workspace, expires the views that showed what changed, and returns
 * the state a `useActionState` form renders.
 *
 * No action trusts a form field for authorization. Ownership is decided by
 * row-level security against the session, so a crafted chat id changes nothing
 * that does not already belong to the caller.
 */

const uuid = z.string().uuid();

const startChat = z.object({
  documentIds: z.array(uuid).min(1, "Choose at least one document."),
  title: z.string().trim().min(1).max(120),
});

const failed = (error: string): ActionState => ({ error });

export const createChat = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const documentIds = formData.getAll("document").map(String);
  const parsed = startChat.safeParse({
    documentIds,
    // Named after what it is about, because "New chat" tells a history page
    // nothing and every conversation would carry the same label.
    title: formData.get("title") || defaultTitle(formData.getAll("document-title").map(String)),
  });

  if (!parsed.success) {
    return failed(parsed.error.issues[0]?.message ?? "Choose at least one document.");
  }

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const created = await bound.value.workspace.createChat(parsed.data);
  if (!created.ok) return failed(created.error.detail ?? "Could not start a conversation.");

  redirect(DASHBOARD_ROUTES.CHAT(created.value));
};

export const renameChat = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = z
    .object({ chatId: uuid, title: z.string().trim().min(1).max(120) })
    .safeParse({ chatId: formData.get("chatId"), title: formData.get("title") });

  if (!parsed.success) return failed("A conversation needs a name of up to 120 characters.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const renamed = await bound.value.workspace.renameChat(parsed.data.chatId, parsed.data.title);
  if (!renamed.ok) return failed(renamed.error.detail ?? "Could not rename it.");

  return { message: "Renamed." };
};

export const deleteChat = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = uuid.safeParse(formData.get("chatId"));
  if (!parsed.success) return failed("No such conversation.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const removed = await bound.value.workspace.removeChat(parsed.data);
  if (!removed.ok) return failed(removed.error.detail ?? "Could not delete it.");

  redirect(DASHBOARD_ROUTES.HISTORY);
};

export const setDocumentScope = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = z
    .object({ chatId: uuid, documentId: uuid, enabled: z.enum(["true", "false"]) })
    .safeParse({
      chatId: formData.get("chatId"),
      documentId: formData.get("documentId"),
      enabled: formData.get("enabled"),
    });

  if (!parsed.success) return failed("No such document in this conversation.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const changed = await bound.value.workspace.setDocumentScope({
    chatId: parsed.data.chatId,
    documentId: parsed.data.documentId,
    enabled: parsed.data.enabled === "true",
  });

  if (!changed.ok) return failed(changed.error.detail ?? "Could not change the scope.");

  return {};
};

export const setWebSearch = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = z
    .object({ chatId: uuid, enabled: z.enum(["true", "false"]) })
    .safeParse({ chatId: formData.get("chatId"), enabled: formData.get("enabled") });

  if (!parsed.success) return failed("No such conversation.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const changed = await bound.value.workspace.setWebSearch(
    parsed.data.chatId,
    parsed.data.enabled === "true",
  );

  if (!changed.ok) return failed(changed.error.detail ?? "Could not change web search.");

  return {};
};

export const addDocumentsToChat = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = z.object({ chatId: uuid, documentIds: z.array(uuid).min(1) }).safeParse({
    chatId: formData.get("chatId"),
    documentIds: formData.getAll("document").map(String),
  });

  if (!parsed.success) return failed("Choose at least one document.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const added = await bound.value.workspace.addDocumentsToChat(parsed.data);
  if (!added.ok) return failed(added.error.detail ?? "Could not add it.");

  return {};
};

export const deleteDocument = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = uuid.safeParse(formData.get("documentId"));
  if (!parsed.success) return failed("No such document.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const removed = await bound.value.workspace.removeDocument(parsed.data);
  if (!removed.ok) return failed(removed.error.detail ?? "Could not delete it.");

  return { message: "Deleted." };
};

/**
 * A signed URL the browser PUTs the bytes to directly, so a 40MB file never
 * passes through a serverless function with a 4.5MB body limit.
 *
 * Called from a hook rather than a form, because the upload it authorizes is
 * work the browser does after this returns.
 */
export const requestUpload = async (input: UploadRequestInput): Promise<UploadTicketState> => {
  const ticket = await requestUploadTicket(input);

  if (!ticket.ok) return { error: ticket.error.detail ?? "Could not start the upload." };

  return { ticket: ticket.value };
};

/** `Q3 report` for one document, `Q3 report and 2 more` beyond that. */
const defaultTitle = (titles: string[]): string => {
  const [first, ...rest] = titles.filter(Boolean);
  if (!first) return "Untitled";

  return rest.length === 0 ? first.slice(0, 120) : `${first.slice(0, 90)} and ${rest.length} more`;
};

/**
 * The passage behind a citation, with the passages either side of it.
 *
 * A server action rather than a route handler because it is a read the browser
 * asks for by id and nothing streams. Row-level security decides whether the
 * chunk is readable, so a crafted id answers null rather than somebody else's
 * document.
 */
export const readPassage = async (chunkId: string): Promise<PassageState> => {
  const parsed = uuid.safeParse(chunkId);
  if (!parsed.success) return { error: "That is not a passage." };

  const bound = await workspaceForRequest();
  if (!bound.ok) return { error: bound.error.detail ?? "Sign in first." };

  const passage = await bound.value.workspace.passage(parsed.data);

  if (!passage.ok) return { error: passage.error.detail ?? "Could not open the passage." };
  if (!passage.value) return { error: "That passage is no longer there." };

  return { passage: passage.value };
};
