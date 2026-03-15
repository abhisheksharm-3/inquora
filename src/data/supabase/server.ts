"use server";

import { TypeDatabase, TypeUser } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/config/env";

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, and Server Actions.
 */
export const supabaseServerClient = async (): Promise<SupabaseClient<TypeDatabase>> => {
    const cookieStore = await cookies();

    return createServerClient<TypeDatabase>(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
                    } catch {
                        // Cookie setting in Server Components is handled by middleware
                    }
                },
            },
        },
    );
};

/**
 * Fetches the details of the currently authenticated user from the 'users' table.
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
