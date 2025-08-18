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