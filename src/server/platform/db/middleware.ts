import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/platform/env";
import { isProtectedRoute, isAuthOnlyRoute, AUTH_ROUTES, DASHBOARD_ROUTES } from "@/config/routes";

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
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
