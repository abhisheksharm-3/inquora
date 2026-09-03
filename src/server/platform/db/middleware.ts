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

  /*
   * A recovery code that arrived at the wrong door.
   *
   * `startPasswordReset` asks Supabase to send people to
   * `/api/auth/callback?next=/reset-password`, and Supabase only honours a
   * `redirect_to` that is in the project's allow list. When it is not, the mail
   * falls back to the site URL, so the link opens the landing page with the
   * code still in the query and nothing exchanges it: the reset flow dead-ends
   * on marketing copy. Whatever page it lands on, the code goes to the one
   * endpoint that can spend it.
   */
  const code = request.nextUrl.searchParams.get("code");

  if (code && pathname !== AUTH_ROUTES.RESET) {
    const callback = new URL("/api/auth/callback", request.url);
    callback.searchParams.set("code", code);
    callback.searchParams.set("next", AUTH_ROUTES.RESET);

    return NextResponse.redirect(callback);
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
