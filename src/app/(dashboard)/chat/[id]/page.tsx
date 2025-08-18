import ChatInterface from "@/components/chat/ChatInterface";
import { generateChatMetadata, validateChatId } from "@/utils/chat-utils";
import { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Dynamically generates SEO metadata for a specific chat page.
 *
 * @param props The properties passed to the page, containing route params.
 * @param props.params The dynamic route parameters wrapped in a Promise.
 * @param props.params.id The unique identifier of the chat.
 * @returns A Promise that resolves to the Metadata object.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const PageParams = await params;
  const chatId = PageParams.id;
  return generateChatMetadata(chatId);
}

/**
 * Renders the page for an individual chat session.
 *
 * This server component validates the chat ID from the URL. If the ID is
 * valid, it renders the client-side `ChatInterface` which manages all
 * interactive chat functionality.
 *
 * @param props The properties passed to the page.
 * @param props.params The route parameters containing the chat `id`.
 * @returns The chat page UI or a 404 page if the ID is invalid.
 */
const ChatPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const PageParams = await params;
  const chatId = PageParams.id;

  // Server-side validation to protect the route.
  if (!validateChatId(chatId)) {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <ChatInterface chatId={chatId} />
    </div>
  );
};

export default ChatPage;