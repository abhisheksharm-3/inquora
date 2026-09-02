import type { Metadata } from "next";
import { workspaceForRequest } from "@/server/modules/workspace/workspace.factory";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { ChooseSurface } from "@/ui/components/documents/ChooseSurface";
import { listDocuments } from "../queries";

export const metadata: Metadata = {
  title: "New conversation",
  description: "Choose what to read.",
};

/**
 * Surface 03, with surface 04 folded into it. The chrome is rendered here and
 * passed down as a prop: it is a server component, so it stays out of the
 * client bundle even though a client component places it in the grid.
 */
const ChoosePage = async () => {
  const [documents, bound] = await Promise.all([listDocuments(), workspaceForRequest()]);

  // The layout already redirected an expired session, so this is narrowing
  // rather than a second guard.
  if (!bound.ok) return null;

  return (
    <ChooseSurface
      chrome={<Chrome current="choose" />}
      documents={documents}
      userId={bound.value.userId}
    />
  );
};

export default ChoosePage;
