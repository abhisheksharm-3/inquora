/**
 * Application route definitions.
 * Centralizes all route paths for type-safe navigation.
 */

/** Public routes accessible without authentication */
export const PUBLIC_ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  PRICING: "/pricing",
  ABOUT: "/about",
  FAQ: "/faq",
} as const;

/** Auth routes */
export const AUTH_ROUTES = {
  LOGIN: "/login",
  SIGNUP: "/signup",
  CALLBACK: "/api/auth/callback",
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

/** API routes */
export const API_ROUTES = {
  AUTH_CALLBACK: "/api/auth/callback",
  HEALTH: "/api/health",
} as const;

/** Route matchers for middleware */
export const ROUTE_MATCHERS = {
  PROTECTED: ["/dashboard", "/chat", "/history", "/settings", "/choose"],
  AUTH_ONLY: ["/login", "/signup"],
  PUBLIC: ["/", "/pricing", "/about", "/faq"],
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
