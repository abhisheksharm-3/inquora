import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { AUTH_ROUTES, DASHBOARD_ROUTES, isAuthOnlyRoute, isProtectedRoute } from "@/core/routes";
import { env } from "@/server/platform/env";

/**
 * Next.js middleware to refresh the user's session and handle route protection.
 */
export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({
            request,
          });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const resourceExtensions = /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js)$/;
  const isResourceRoute =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    resourceExtensions.test(pathname);

  if (isResourceRoute) {
    return response;
  }

  const isAuthRoute = isAuthOnlyRoute(pathname);
  const dashboardUrl = new URL(DASHBOARD_ROUTES.HOME, request.url);

  if (user) {
    if (isAuthRoute || pathname === "/") {
      return NextResponse.redirect(dashboardUrl);
    }
  } else {
    if (isProtectedRoute(pathname)) {
      const loginUrl = new URL(AUTH_ROUTES.LOGIN, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
};
