import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/core/routes";
import { workspaceForRequest } from "@/server/modules/workspace/workspace.factory";

/**
 * The signed-in shell. The proxy already redirects an anonymous request, so this
 * is the second of two checks rather than the only one: a session that expires
 * between the proxy and the render would otherwise reach a surface that renders
 * an empty account instead of asking the person to sign in again.
 *
 * There is no chrome here. Each surface renders its own, because the chrome
 * spans both columns of the grid the surface owns, and lifting it into a
 * wrapper would put a div between the grid and its cells.
 */
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const bound = await workspaceForRequest();

  if (!bound.ok) redirect(AUTH_ROUTES.LOGIN);

  return children;
};

export default AppLayout;
