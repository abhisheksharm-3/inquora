import type { Account } from "@/core/workspace/account.types";
import type {
  AccountUsage,
  ChatDetail,
  ChatEntry,
  DocumentEntry,
} from "@/core/workspace/workspace.types";
import { currentAccount } from "@/server/modules/auth/auth.service";
import { workspaceForRequest } from "@/server/modules/workspace/workspace.factory";

/**
 * The reads the signed-in surfaces do.
 *
 * None of them is cached, and the reason is worth writing down because the UI
 * scope document proposed `'use cache'` with tags for exactly these lists.
 * Every read here runs as the signed-in person, which means creating a Supabase
 * client from the session cookie, and Next refuses `cookies()` inside a cache
 * scope: "Accessing Dynamic data sources inside a cache scope is not
 * supported."
 *
 * The way around it would be a service-role client inside the cache, filtered
 * by a user id passed in as an argument. That moves authorization out of
 * row-level security and into a `where` clause written by hand, which is the
 * class of mistake this rebuild exists to remove. A 30ms query is the cheaper
 * of the two.
 *
 * What replaces the cache is streaming: each surface wraps its list in
 * `<Suspense>`, so the shell paints immediately and the list arrives when the
 * database answers. Server actions refresh the surface they were called from,
 * so a rename or a delete is visible without a tag to expire.
 */

/**
 * An empty list rather than a thrown error: the layout has already redirected
 * an anonymous request, so reaching here without a session means it expired
 * between the redirect and the render, and the next navigation asks for a
 * sign-in.
 */
export const listChats = async (): Promise<ChatEntry[]> => {
  const bound = await workspaceForRequest();
  if (!bound.ok) return [];

  const chats = await bound.value.workspace.listChats();

  return chats.ok ? chats.value : [];
};

export const listDocuments = async (): Promise<DocumentEntry[]> => {
  const bound = await workspaceForRequest();
  if (!bound.ok) return [];

  const documents = await bound.value.workspace.listDocuments();

  return documents.ok ? documents.value : [];
};

export const readChat = async (chatId: string): Promise<ChatDetail | null> => {
  const bound = await workspaceForRequest();
  if (!bound.ok) return null;

  const chat = await bound.value.workspace.chat(chatId);

  return chat.ok ? chat.value : null;
};

/** Who is signed in, for the bar. Null only if the session expired mid-render. */
export const readAccount = async (): Promise<Account | null> => {
  const account = await currentAccount();

  return account.ok ? account.value : null;
};

export const readUsage = async (): Promise<AccountUsage | null> => {
  const bound = await workspaceForRequest();
  if (!bound.ok) return null;

  const usage = await bound.value.workspace.usage();

  return usage.ok ? usage.value : null;
};
