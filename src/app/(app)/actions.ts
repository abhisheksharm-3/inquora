"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sourceKindForUrl, titleForUrl } from "@/core/documents/kind";
import { DASHBOARD_ROUTES } from "@/core/routes";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { signOut } from "@/server/modules/auth/auth.service";
import { addSourceByUrl, requestUploadTicket } from "@/server/modules/documents/documents.factory";
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

/** Enough to choose from without becoming a page of results. */
const DOCUMENT_SEARCH_LIMIT = 8;

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

/**
 * Sign out, then go to the landing page.
 *
 * A server action rather than a route, because it changes a cookie and then
 * navigates, which is exactly what an action does. `redirect` after it so the
 * browser lands somewhere a signed-out person can be.
 */
export const signOutAction = async (): Promise<void> => {
  await signOut();

  redirect("/");
};

/**
 * Ask a question from the home screen.
 *
 * One act rather than three. The screen this replaced made you pick documents,
 * press a button, land in an empty conversation and then type — so the thing
 * somebody came to do was four steps from the door. Here the question and the
 * documents arrive together: the chat is created, and the question travels with
 * the redirect so the conversation opens already answering it.
 */
export const askFromHome = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const question = String(formData.get("question") ?? "").trim();
  const documentIds = formData.getAll("document").map(String);

  if (!question) return failed("Type a question first.");

  const parsed = z.array(uuid).min(1).safeParse(documentIds);
  if (!parsed.success) return failed("Choose at least one document to read.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  // Named after the question rather than the files. On a history page "Why did
  // Q3 revenue miss the forecast?" tells you what it was; "q3-forecast.xlsx and
  // 2 more" does not.
  const created = await bound.value.workspace.createChat({
    title: question.slice(0, 120),
    documentIds: parsed.data,
  });

  if (!created.ok) return failed(created.error.detail ?? "Could not start it.");

  redirect(`${DASHBOARD_ROUTES.CHAT(created.value)}?ask=${encodeURIComponent(question)}`);
};

/**
 * Add a repository, a video or a web page by its link.
 *
 * All three have worked in the extractor since the backend was built and the
 * interface offered none of them, so the only way in was a file. Which kind a
 * link is comes from its host, and a link that is neither GitHub nor YouTube is
 * read as a page.
 */
export const addLink = async (_previous: ActionState, formData: FormData): Promise<ActionState> => {
  const raw = String(formData.get("url") ?? "");
  const source = sourceKindForUrl(raw);

  if (!source) {
    return failed("That is not a link. Paste a web address starting with https://");
  }

  const added = await addSourceByUrl({
    url: source.url,
    kind: source.kind,
    title: titleForUrl(source.url, source.kind),
  });

  if (!added.ok) return failed(added.error.detail ?? "Could not add that link.");

  return {
    message: added.value.alreadyIndexed
      ? "You have already added that one."
      : "Reading it now. It appears in your files when it is ready.",
  };
};

/**
 * Documents matching what somebody has typed, for the picker in the composer.
 *
 * Searched in Postgres. The home screen lists three documents and somebody with
 * forty needs the ninth, and filtering in the browser would mean downloading
 * every document they own on every visit — which stops working at the point the
 * feature becomes necessary.
 */
export const findDocuments = async (query: string): Promise<DocumentEntry[]> => {
  const bound = await workspaceForRequest();
  if (!bound.ok) return [];

  const found = await bound.value.workspace.findDocuments(query, DOCUMENT_SEARCH_LIMIT);

  return found.ok ? found.value : [];
};

/** Read a document again, after it failed or stalled. */
export const retryDocument = async (
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const parsed = uuid.safeParse(formData.get("documentId"));
  if (!parsed.success) return failed("No such document.");

  const bound = await workspaceForRequest();
  if (!bound.ok) return failed(bound.error.detail ?? "Sign in first.");

  const retried = await bound.value.workspace.retryDocument(parsed.data);
  if (!retried.ok) return failed(retried.error.detail ?? "Could not retry it.");

  return { message: "Reading it again." };
};
