"use server";

import { supabaseServerClient } from "@/utils/supabase/server";

/**
 * Extracts form data safely with type casting.
 */
const extractFormData = (formData: FormData, fields: string[]) => {
  return fields.reduce((acc, field) => {
    acc[field] = formData.get(field) as string;
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Handles authentication errors consistently.
 */
const handleAuthError = (error: unknown): string => {
  return `${error}`;
};

/**
 * Server Action to sign in a user with email and password.
 * @param {FormData} formData - Must contain 'email' and 'password' fields.
 * @returns {Promise<string | void>} An error message on failure, otherwise void.
 */
export const signIn = async (formData: FormData) => {
  const { email, password } = extractFormData(formData, ["email", "password"]);
  const supabase = await supabaseServerClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    return handleAuthError(error);
  }
};

/**
 * Server Action to create a new user account.
 * @param {FormData} formData - Must contain 'full-name', 'email', and 'password'.
 * @returns {Promise<string | void>} An error message on failure, otherwise void.
 */
export const signUp = async (formData: FormData) => {
  const {
    "full-name": fullName,
    email,
    password,
  } = extractFormData(formData, ["full-name", "email", "password"]);
  const supabase = await supabaseServerClient();

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    return handleAuthError(error);
  }
};

/**
 * Server Action to sign in with Google OAuth.
 * @returns {Promise<string | void>} An error message on failure, otherwise void.
 */
export const signInWithGoogle = async () => {
  const supabase = await supabaseServerClient();

  try {
    // Dynamically determine the correct redirect URL
    const redirectUrl = getAuthRedirectUrl();
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${redirectUrl}/api/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    return handleAuthError(error);
  }
};

/**
 * Determines the correct redirect URL for OAuth based on environment
 * @returns {string} The base URL for redirects
 */
function getAuthRedirectUrl(): string {
  // In development, use localhost
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // In production, try to get the URL from various sources
  // First try SITE_URL if it's set
  if (process.env.SITE_URL) {
    return process.env.SITE_URL;
  }
  
  // Try VERCEL_URL for Vercel deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Try NEXT_PUBLIC_SITE_URL as a fallback
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Default fallback (you should set this to your actual production domain)
  return 'https://inquora.vercel.app';
}