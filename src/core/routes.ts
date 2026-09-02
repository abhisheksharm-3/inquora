/**
 * Application route definitions.
 * Centralizes all route paths for type-safe navigation.
 */

/** Auth routes */
export const AUTH_ROUTES = {
  LOGIN: "/login",
  SIGNUP: "/signup",
  CALLBACK: "/api/auth/callback",
  FORGOT: "/forgot-password",
  RESET: "/reset-password",
  LOGOUT: "/logout",
} as const;

/**
 * Routes that require a session.
 *
 * `/ask` rather than `/choose`. The old name described what the screen made you
 * do — choose documents from a list — and that screen is gone. This one is for
 * asking, so it says so, and an address a person can read is worth the rename.
 */
export const DASHBOARD_ROUTES = {
  HOME: "/ask",
  CHAT: (chatId: string) => `/chat/${chatId}` as const,
  HISTORY: "/history",
  SETTINGS: "/settings",
} as const;

/** Route matchers for middleware */
export const ROUTE_MATCHERS = {
  PROTECTED: ["/ask", "/chat", "/history", "/settings"],
  // Not the recovery routes. A recovery link signs you in before you set a new
  // password, and an auth-only rule would bounce you to the dashboard with the
  // old password still in place.
  AUTH_ONLY: ["/login", "/signup"],
} as const;

/**
 * Checks if a pathname matches any of the protected routes.
 */
export function isProtectedRoute(pathname: string): boolean {
  return ROUTE_MATCHERS.PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Checks if a pathname is an auth-only route (login/signup).
 */
export function isAuthOnlyRoute(pathname: string): boolean {
  return ROUTE_MATCHERS.AUTH_ONLY.some((route) => pathname === route);
}
