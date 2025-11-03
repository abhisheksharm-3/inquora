import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/utils/supabase/server";
import type { TypeUser } from "@/types/TypeSupabase";
import { User } from "@supabase/supabase-js";

/**
 * Authentication callback handler for processing OAuth code exchanges
 *
 * @description Handles the OAuth callback by exchanging the authorization code
 * for a session through Supabase auth. After successful authentication,
 * redirects the user to the specified page or dashboard by default.
 *
 * @param request - Incoming request object containing the auth code
 * @returns A redirect response to either the target page or an error page
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/choose";

    // If no code is provided, redirect to error page
    if (!code) {
      console.error("No authorization code provided in callback");
      return createRedirectResponse(`${origin}/auth/auth-code-error`);
    }

    // Exchange the code for a session
    const supabase = await supabaseServerClient();
    const { data: sessionData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    // If exchange failed, redirect to error page
    if (error) {
      console.error("Auth code exchange error:", error.message);
      return createRedirectResponse(`${origin}/auth/auth-code-error`);
    }

    // Create user profile in the public users table if it doesn't exist
    if (sessionData?.session?.user) {
      await createUserProfileIfNotExists(supabase, sessionData.session.user);
    }

    // Authentication successful, determine the correct redirect URL
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
function determineRedirectUrl(
  request: NextRequest,
  origin: string,
  path: string,
): string {
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
    status: 302, // Temporary redirect
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/**
 * Creates a user profile in the public users table if it doesn't already exist
 * This is necessary for OAuth users since they bypass the normal signup flow
 *
 * @param supabase - The Supabase client instance
 * @param user - The authenticated user object from Supabase auth
 */
async function createUserProfileIfNotExists(
  supabase: Awaited<ReturnType<typeof supabaseServerClient>>,
  user: User,
): Promise<void> {
  try {
    // Check if user profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    // If user already exists, no need to create
    if (existingProfile) {
      console.log("User profile already exists for:", user.email);
      return;
    }

    // If there was an error other than "not found", log it
    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error checking for existing user profile:", fetchError);
      return;
    }

    // Create the user profile
    const defaultUser: Partial<TypeUser> = {
      id: user.id,
      email: user.email || "",
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.display_name ||
        null,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("users")
      .insert(defaultUser);

    if (insertError) {
      // If error is duplicate key (race condition), that's fine
      if (insertError.code === "23505") {
        console.log(
          "User profile already exists (race condition):",
          user.email,
        );
        return;
      }
      // Log any other error
      console.error("Failed to create user profile:", insertError);
      console.error("Error details:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      return;
    }

    console.log("✅ Successfully created user profile for:", user.email);
  } catch (error) {
    console.error("Error in createUserProfileIfNotExists:", error);
    // Don't throw - we don't want to break the OAuth flow
  }
}
