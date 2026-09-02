/**
 * What an authentication form renders after a submit. One shape for every auth
 * action, because `useActionState` holds one state per form.
 *
 * Empty means nothing has been submitted yet. A success that leads somewhere
 * else never reaches here, because the action redirects instead of returning.
 */
export type AuthState = {
  /** Cause and next action, shown beside the field it concerns. */
  error?: string;
  /** What happened, when the answer is not a redirect. */
  message?: string;
  /** Which field the error belongs beside. */
  field?: "full-name" | "email" | "password";
};

export const emptyAuthState: AuthState = {};
