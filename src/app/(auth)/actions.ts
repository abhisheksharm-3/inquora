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

/** The named fields of a form, as an object the schema can parse. */
function fields(formData: FormData, schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(schema.shape).map((key) => [key, formData.get(key)]));
}

/**
 * These actions return a message or nothing. Everything else — the rate limit,
 * the provider call, where a confirmation link points — belongs to the auth
 * module, so this file stays about reading a form.
 */
export const signIn = async (formData: FormData) => {
  // Parsed outside the try, so only a validation failure produces a validation
  // message. Wrapping the service call in the same catch reported a provider
  // outage as "enter an email address", with nothing logged and nothing to
  // distinguish it from an empty field.
  const parsed = loginSchema.safeParse(fields(formData, loginSchema));

  if (!parsed.success) return "Enter an email address and a password.";

  const result = await signInWithPassword(parsed.data.email, parsed.data.password);

  return result.ok ? undefined : (result.error.detail ?? "Could not sign you in.");
};

export const signUp = async (formData: FormData) => {
  const parsed = signupSchema.safeParse(fields(formData, signupSchema));

  if (!parsed.success) {
    return "Enter your name, an email address, and a password of at least six characters.";
  }

  const result = await signUpWithPassword(
    parsed.data.email,
    parsed.data.password,
    parsed.data["full-name"],
  );

  return result.ok ? undefined : (result.error.detail ?? "Could not create your account.");
};

export const signInWithGoogle = async (nextUrl?: string | null) => {
  const result = await startGoogleSignIn(nextUrl);

  return result.ok ? result.value : (result.error.detail ?? "Could not reach Google.");
};
