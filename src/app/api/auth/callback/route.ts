import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { completeOAuthSignIn, signedInDestination } from "@/server/modules/auth/auth.service";

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
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const rawNext = searchParams.get("next") ?? "/choose";
    const next = validateNextPath(rawNext);

    if (!code) {
      console.error("No authorization code provided in callback");
      return createRedirectResponse(await signedInDestination("/auth/auth-code-error"));
    }

    const exchanged = await completeOAuthSignIn(code);

    if (!exchanged.ok) {
      console.error("Auth code exchange failed:", exchanged.error.detail);
      return createRedirectResponse(await signedInDestination("/auth/auth-code-error"));
    }

    // The profile row is created by the on_auth_user_created trigger, so an
    // OAuth sign-in needs no write here. The application used to do it, which
    // is how identity came to live in two places.
    return createRedirectResponse(await signedInDestination(next));
  } catch (error) {
    console.error("Unexpected error during auth callback:", error);
    return createRedirectResponse(await signedInDestination("/auth/auth-code-error"));
  }
}

/**
 * A redirect that is never cached, because the destination depends on a session
 * that has just changed.
 *
 * The URL is always built against `siteUrl()`. It used to be built from the
 * `x-forwarded-host` request header, which the client supplies: a callback
 * carrying `x-forwarded-host: evil.example` sent a just-signed-in user there.
 * No token leaked, because the session cookie belongs to the real domain, but an
 * open redirect off an authentication endpoint is the shape phishing wants.
 */
function createRedirectResponse(url: string): NextResponse {
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
