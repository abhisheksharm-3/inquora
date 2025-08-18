import { useFileById } from "@/hooks/useFiles";
import { TypeChat } from "@/types/TypeSupabase";
import { HistoryPageChatMetadata } from "./HistoryPageChatMetadata";
import { HistorypageChatDropdown } from "./HistoryPageChatDropdown";
import Link from "next/link";

/**
 * A responsive glass-morphism themed list item representing a single chat in the history.
 */
export const HistoryPageChatItem = ({ chat }: { chat: TypeChat }) => {
  const { data: fileData } = useFileById(chat.file_id || "");
  const file = fileData ? {
    name: fileData.name,
    type: fileData.type ?? "unknown",
    size: fileData.size ?? 0,
  } : undefined;

  return (
    <div className="group relative rounded-xl backdrop-blur-sm bg-card/40 border border-border/40 transition-all duration-200 hover:bg-card/60 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98] sm:active:scale-100">
      <Link href={`/chat/${chat.id}`} className="block p-5 md:p-6 pr-14 md:pr-16">
        <HistoryPageChatMetadata chat={chat} file={file} />
      </Link>
      <HistorypageChatDropdown chat={chat} file={file} />
    </div>
  );
};