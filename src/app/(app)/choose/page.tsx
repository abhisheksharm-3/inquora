import type { Metadata } from "next";
import { workspaceForRequest } from "@/server/modules/workspace/workspace.factory";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { ChooseSurface } from "@/ui/components/documents/ChooseSurface";
import { listChats, listDocuments, readAccount } from "../queries";

export const metadata: Metadata = {
  title: "Your documents",
  description: "Add a document, or ask one of the ones you have.",
};

/**
 * The home of the product. The chrome is rendered here and passed down as a
 * prop: it is a server component, so it stays out of the client bundle even
 * though a client component places it in the grid.
 */
const ChoosePage = async () => {
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
    <ChooseSurface
      chrome={<Chrome current="choose" account={account} />}
      documents={documents}
      chats={chats}
      userId={bound.value.userId}
    />
  );
};

export default ChoosePage;
