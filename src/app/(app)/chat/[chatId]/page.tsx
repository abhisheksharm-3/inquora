import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

const ChatPage = async ({ params }: { params: Promise<{ chatId: string }> }) => {
  const { chatId } = await params;
  const chat = await readChat(chatId);

  // Row-level security already refuses somebody else's conversation, so a null
  // here means it does not exist or is not theirs, and both answer 404. Saying
  // which would confirm that an id belongs to someone.
  if (!chat) notFound();

  return <ChatSurface chrome={<Chrome current="chat" />} chat={chat} />;
};

export default ChatPage;
