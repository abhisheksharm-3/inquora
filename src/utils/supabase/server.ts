"use server";

import { TypeDatabase, TypeUser } from "@/types/TypeSupabase";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, and Server Actions.
 * This function encapsulates the logic for handling cookies on the server side.
 *
 * @returns An instance of the Supabase client configured for server-side operations.
 */
export const supabaseServerClient = async (): Promise<SupabaseClient<TypeDatabase>> => {
  const cookieStore = await cookies();

  return createServerClient<TypeDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            console.warn("Cookies were set from a Server Component.", error);
          }
        },
      },
    },
  );
};

/**
 * Fetches the details of the currently authenticated user from the 'users' table.
 *
 * @returns A promise that resolves to the user's details (TypeUser) or null if not found or an error occurs.
 */
export const getUserDetails = async (): Promise<TypeUser | null> => {
  const supabase = await supabaseServerClient();
  try {
    const { data: userDetails, error } = await supabase
      .from("users")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching user details:", error.message);
      return null;
    }

    return userDetails;
  } catch (error) {
    console.error("An unexpected error occurred in getUserDetails:", error);
    return null;
  }
};
