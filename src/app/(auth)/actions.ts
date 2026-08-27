"use server";

import { z } from "zod";
import {
  signInWithPassword,
  signUpWithPassword,
  startGoogleSignIn,
} from "@/server/modules/auth/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  "full-name": z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

/** Reads the named fields out of a form and validates them together. */
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
 * These actions return a message or nothing. Everything else — the rate limit,
 * the provider call, where a confirmation link points — belongs to the auth
 * module, so this file stays about reading a form.
 */
export const signIn = async (formData: FormData) => {
  try {
    const { email, password } = extractFormData(formData, loginSchema);
    const result = await signInWithPassword(email, password);

    if (!result.ok) return result.error.detail ?? "Could not sign you in.";
  } catch {
    return "Enter an email address and a password.";
  }
};

export const signUp = async (formData: FormData) => {
  try {
    const data = extractFormData(formData, signupSchema);
    const result = await signUpWithPassword(data.email, data.password, data["full-name"]);

    if (!result.ok) return result.error.detail ?? "Could not create your account.";
  } catch {
    return "Enter your name, an email address, and a password of at least six characters.";
  }
};

export const signInWithGoogle = async (nextUrl?: string | null) => {
  const result = await startGoogleSignIn(nextUrl);

  return result.ok ? result.value : (result.error.detail ?? "Could not reach Google.");
};
