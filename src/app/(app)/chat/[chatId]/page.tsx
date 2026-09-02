import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPassage } from "@/app/(app)/actions";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { ChatSurface } from "@/ui/components/chat/ChatSurface";
import { readChat } from "../../queries";

/**
 * The per-chat title, which the old interface never set: every tab said
 * "Inquora", so a reader with four conversations open could not tell them apart.
 */
export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ chatId: string }>;
}): Promise<Metadata> => {
  const { chatId } = await params;
  const chat = await readChat(chatId);

  return { title: chat?.title ?? "Conversation" };
};

/**
 * Surfaces 05, 06 and 07. Following a citation is a navigation to `?passage=`
 * rather than a click handler, so the reading column swaps, the apparatus stays
 * where it was, the view is shareable, and the browser's back button is the one
 * action that returns.
 *
 * The passage is read here rather than in the browser: it is a database read,
 * and doing it on the server means the viewer arrives with the page instead of
 * after a round trip.
 */
const ChatPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>;
  searchParams: Promise<{ passage?: string; specimen?: string }>;
}) => {
  const [{ chatId }, query] = await Promise.all([params, searchParams]);
  const chat = await readChat(chatId);

  // Row-level security already refuses somebody else's conversation, so a null
  // here means it does not exist or is not theirs, and both answer 404. Saying
  // which would confirm that an id belongs to someone.
  if (!chat) notFound();

  const followed = query.passage ? await readPassage(query.passage) : undefined;

  return (
    <ChatSurface
      chrome={<Chrome current="chat" />}
      chat={chat}
      following={
        followed?.passage
          ? { passage: followed.passage, specimenNumber: Number(query.specimen) || 1 }
          : undefined
      }
    />
  );
};

export default ChatPage;
