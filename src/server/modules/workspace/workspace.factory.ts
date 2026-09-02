import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import { createServerDbClient } from "@/server/platform/db/client";
import { createWorkspaceRepository } from "./workspace.repository";
import type { WorkspaceRepository } from "./workspace.types";

/**
 * The workspace, bound to the signed-in person for one request.
 *
 * getUser, not getSession: getSession trusts whatever is in the cookie, while
 * getUser verifies the token with the auth server. Row-level security would
 * refuse a stranger either way, but a 401 says what is wrong where an empty
 * list would imply the account has nothing in it.
 */
export const workspaceForRequest = async (): Promise<
  Result<{ workspace: WorkspaceRepository; userId: string }, AppError>
> => {
  const db = await createServerDbClient();
  const { data: identity } = await db.auth.getUser();

  if (!identity.user) return err(AppError.unauthorized("sign in first"));

  return ok({ workspace: createWorkspaceRepository(db), userId: identity.user.id });
};
