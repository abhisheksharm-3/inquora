import type { Metadata } from "next";
import { workspaceForRequest } from "@/server/modules/workspace/workspace.factory";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { HomeSurface } from "@/ui/components/home/HomeSurface";
import { listChats, listDocuments, readAccount } from "../queries";

export const metadata: Metadata = {
  title: "Ask your documents",
  description: "Ask a question of what you have added, and follow every answer to its source.",
};

const HomePage = async () => {
  const [documents, chats, account, bound] = await Promise.all([
    listDocuments(),
    listChats(),
    readAccount(),
    workspaceForRequest(),
  ]);

  // The layout already redirected an expired session, so this is narrowing
  // rather than a second guard.
  if (!bound.ok) return null;

  return (
    <HomeSurface
      chrome={<Chrome current="ask" account={account} />}
      account={account}
      documents={documents}
      chats={chats}
      userId={bound.value.userId}
    />
  );
};

export default HomePage;
