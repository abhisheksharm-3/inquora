import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js middleware to refresh the user's session and handle route protection.
 *
 * This function runs on every request to:
 * 1. Refresh the Supabase session token by managing cookies.
 * 2. Redirect unauthenticated users from protected routes to the login page.
 * 3. Redirect authenticated users from auth routes (login/signup) to the dashboard.
 *
 * @param request The incoming Next.js request object.
 * @returns A NextResponse object that either continues the request chain or issues a redirect.
 */
export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
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

  // --- Route Definitions ---
  const publicRoutes = ["/"];
  const authRoutes = ["/login", "/signup"];
  const resourceExtensions = /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js)$/;
  const isResourceRoute =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    resourceExtensions.test(pathname);

  // Allow all resource requests to pass through without checks.
  if (isResourceRoute) {
    return response;
  }

  const isPublic = publicRoutes.includes(pathname);
  const isAuthRoute = authRoutes.includes(pathname);
  const dashboardUrl = new URL("/choose", request.url);

  // --- Redirect Logic ---

  // If the user is authenticated...
  if (user) {
    // and tries to access an auth route or the root page, redirect to the dashboard.
    if (isAuthRoute || pathname === "/") {
      return NextResponse.redirect(dashboardUrl);
    }
  }
  // If the user is not authenticated...
  else {
    // and tries to access a protected route, redirect to the login page.
    if (!isPublic && !isAuthRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Otherwise, allow the request to proceed.
  return response;
};
