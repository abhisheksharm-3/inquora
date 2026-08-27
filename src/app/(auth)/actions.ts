"use server";

import { supabaseServerClient } from "@/data/supabase/server";
import { getSiteUrl } from "@/config/env";
import { z } from "zod";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/utils/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  "full-name": z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * Extracts and validates form data.
 */
function extractFormData<T extends z.ZodObject<z.ZodRawShape>>(
  formData: FormData,
  schema: T,
): z.infer<T> {
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(schema.shape)) {
    data[key] = formData.get(key);
  }
  return schema.parse(data);
}

/**
 * Server Action to sign in a user with email and password.
 */
export const signIn = async (formData: FormData) => {
  const supabase = await supabaseServerClient();

  try {
    const { email, password } = extractFormData(formData, loginSchema);

    const rateLimitResult = await checkRateLimit(`auth:login:${email}`, RATE_LIMIT_CONFIGS.auth);
    if (!rateLimitResult.allowed) {
      return "Too many login attempts. Please wait a moment before trying again.";
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    return `${error}`;
  }
};

/**
 * Server Action to create a new user account.
 */
export const signUp = async (formData: FormData) => {
  const supabase = await supabaseServerClient();

  try {
    const data = extractFormData(formData, signupSchema);

    const rateLimitResult = await checkRateLimit(
      `auth:signup:${data.email}`,
      RATE_LIMIT_CONFIGS.signup,
    );
    if (!rateLimitResult.allowed) {
      return "Too many signup attempts. Please wait before trying again.";
    }

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data["full-name"],
        },
      },
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    return `${error}`;
  }
};

function isValidNextPath(next: string): boolean {
  const trimmed = next.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}

export const signInWithGoogle = async (nextUrl?: string | null) => {
  const supabase = await supabaseServerClient();

  try {
    const redirectUrl = getSiteUrl();
    const baseCallback = `${redirectUrl}/api/auth/callback`;
    const callbackUrl =
      nextUrl && isValidNextPath(nextUrl)
        ? `${baseCallback}?next=${encodeURIComponent(nextUrl)}`
        : baseCallback;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    return `${error}`;
  }
};
