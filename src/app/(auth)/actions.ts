"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DASHBOARD_ROUTES } from "@/core/routes";
import {
  signInWithPassword,
  signUpWithPassword,
  startGoogleSignIn,
} from "@/server/modules/auth/auth.service";
import type { AuthState } from "./auth.types";

/**
 * The transport edge for authentication. It reads a form, hands the values to
 * the auth module, and returns the state a `useActionState` form renders.
 *
 * Everything else — how many times a password may be guessed, where a
 * confirmation link points, what happens to the profile row — belongs to the
 * module, so this file stays about reading a form.
 */

const signInFields = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signUpFields = z.object({
  "full-name": z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

/** The named fields of a form, as an object the schema can parse. */
const fields = (formData: FormData, schema: z.ZodObject<z.ZodRawShape>) =>
  Object.fromEntries(Object.keys(schema.shape).map((key) => [key, formData.get(key)]));

export const signIn = async (_previous: AuthState, formData: FormData): Promise<AuthState> => {
  // Parsed outside the try, so only a validation failure produces a validation
  // message. Wrapping the module call in the same catch reported a provider
  // outage as "enter an email address".
  const parsed = signInFields.safeParse(fields(formData, signInFields));

  if (!parsed.success) {
    return { error: "Enter an email address and a password.", field: "email" };
  }

  const result = await signInWithPassword(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    return { error: result.error.detail ?? "Could not sign you in.", field: "password" };
  }

  // Outside the failure paths because redirect() signals by throwing. The
  // destination is a constant, never a value read from the form, so a crafted
  // field cannot choose where a just-signed-in person lands.
  redirect(DASHBOARD_ROUTES.HOME);
};

export const signUp = async (_previous: AuthState, formData: FormData): Promise<AuthState> => {
  const parsed = signUpFields.safeParse(fields(formData, signUpFields));

  if (!parsed.success) {
    return {
      error: "Enter your name, an email address, and a password of at least six characters.",
      field: "password",
    };
  }

  const result = await signUpWithPassword(
    parsed.data.email,
    parsed.data.password,
    parsed.data["full-name"],
  );

  if (!result.ok) {
    return { error: result.error.detail ?? "Could not create your account.", field: "email" };
  }

  // No redirect: the account exists but the email is unconfirmed, and sending
  // somebody to a sign-in page that will refuse them is worse than telling them
  // what to do next.
  return { message: `Check ${parsed.data.email} for the confirmation link.` };
};

export const signInWithGoogle = async (
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> => {
  const next = formData.get("next");
  const result = await startGoogleSignIn(typeof next === "string" ? next : null);

  if (!result.ok) return { error: result.error.detail ?? "Could not reach Google." };

  redirect(result.value.url);
};
