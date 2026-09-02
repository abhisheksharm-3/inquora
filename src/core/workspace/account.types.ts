/**
 * Who is signed in, as the bar shows them.
 *
 * In core because it crosses from the server to the interface: the account
 * menu is a component, and a component reaching into `server/modules` for a
 * type is a boundary violation.
 */
export type Account = {
  id: string;
  email: string;
  displayName: string | null;
  /** Set when they signed in with Google, which supplies a picture. */
  avatarUrl: string | null;
};
