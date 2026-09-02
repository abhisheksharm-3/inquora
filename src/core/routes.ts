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

/** Dashboard routes requiring authentication */
export const DASHBOARD_ROUTES = {
  HOME: "/choose",
  CHAT: (chatId: string) => `/chat/${chatId}` as const,
  HISTORY: "/history",
  SETTINGS: "/settings",
  CHOOSE: "/choose",
} as const;

/** Route matchers for middleware */
export const ROUTE_MATCHERS = {
  PROTECTED: ["/dashboard", "/chat", "/history", "/settings", "/choose"],
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
