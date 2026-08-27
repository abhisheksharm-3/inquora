import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { completeOAuthSignIn } from "@/server/modules/auth/auth.service";

function validateNextPath(next: string): string {
  const trimmed = next.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("?") ||
    trimmed.includes("#")
  ) {
    return "/choose";
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost" || parsed.pathname !== trimmed) {
      return "/choose";
    }
  } catch {
    return "/choose";
  }
  return trimmed;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const rawNext = searchParams.get("next") ?? "/choose";
    const next = validateNextPath(rawNext);

    if (!code) {
      console.error("No authorization code provided in callback");
      return createRedirectResponse(`${origin}/auth/auth-code-error`);
    }

    const exchanged = await completeOAuthSignIn(code);

    if (!exchanged.ok) {
      console.error("Auth code exchange failed:", exchanged.error.detail);
      return createRedirectResponse(`${origin}/auth/auth-code-error`);
    }

    // The profile row is created by the on_auth_user_created trigger, so an
    // OAuth sign-in needs no write here. The application used to do it, which
    // is how identity came to live in two places.
    return createRedirectResponse(determineRedirectUrl(request, origin, next));
  } catch (error) {
    console.error("Unexpected error during auth callback:", error);
    const origin = new URL(request.url).origin;
    return createRedirectResponse(`${origin}/auth/auth-code-error`);
  }
}

/**
 * Determines the appropriate redirect URL based on environment and request headers
 *
 * @param request - The original request object
 * @param origin - The origin of the request
 * @param path - The path to redirect to
 * @returns The complete redirect URL
 */
function determineRedirectUrl(request: NextRequest, origin: string, path: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    // Local environment: use original origin
    return `${origin}${path}`;
  }

  if (forwardedHost) {
    // Production behind load balancer: use forwarded host with proper protocol
    return `${forwardedProto}://${forwardedHost}${path}`;
  }

  // Default case: use original origin
  return `${origin}${path}`;
}

/**
 * Creates a redirect response with the appropriate headers
 *
 * @param url - The URL to redirect to
 * @returns A configured NextResponse object
 */
function createRedirectResponse(url: string): NextResponse {
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
