"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/data/supabase/client";
import { TypeUser } from "@/types/database";
import { Session } from "@supabase/supabase-js";

/** The base query key for the authenticated user's session and profile. */
export const USER_QUERY_KEY = ["user"];

/**
 * A custom hook for managing the user's authentication session and profile data.
 *
 * This hook fetches the user session and profile in a single query and provides
 * reactive state, derived values, and mutation functions for profile updates and sign-out.
 *
 * @returns An object containing the user's data, auth status, and action handlers.
 */
export const useUser = () => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();

  /**
   * Main query to fetch both the user session and their profile from the 'users' table.
   * This runs once and provides all necessary user data.
   */
  const {
    data: userData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: async () => {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();
      if (sessionError) throw sessionError;
      if (!user) return { session: null, profile: null };

      const session = { user };
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, email, name, created_at")
        .eq("id", user.id)
        .single<TypeUser>();

      // A missing profile is not a critical error (e.g., new user).
      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      return { session, profile };
    },
  });

  /** Mutation to update the user's profile. */
  const {
    mutate: updateUser,
    mutateAsync: updateUserAsync,
    isPending: isUpdating,
  } = useMutation({
    mutationFn: async (updatedData: Partial<TypeUser>) => {
      if (!userData?.session?.user) throw new Error("User not authenticated.");

      const { data, error: updateError } = await supabase
        .from("users")
        .update(updatedData)
        .eq("id", userData.session.user.id)
        .select()
        .single<TypeUser>();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (updatedProfile) => {
      // Optimistically update the cache with the new profile data.
      queryClient.setQueryData(
        USER_QUERY_KEY,
        (
          oldData: { session: Session | null; profile: TypeUser | null } | null,
        ) => ({
          ...oldData,
          profile: updatedProfile,
        }),
      );
    },
  });

  /** Mutation to sign the user out. */
  const {
    mutate: signOut,
    mutateAsync: signOutAsync,
    isPending: isSigningOut,
  } = useMutation({
    mutationFn: async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    onSuccess: () => {
      // Clear the user query from the cache upon successful sign-out.
      queryClient.setQueryData(USER_QUERY_KEY, null);
    },
  });

  /**
   * A fallback user object created from session data.
   * This provides a better UX while the full profile is loading or if it doesn't exist.
   */
  const userFallback: TypeUser | null = userData?.session?.user
    ? {
      id: userData.session.user.id,
      email: userData.session.user.email ?? "",
      name: userData.session.user.user_metadata?.full_name ?? "",
      created_at:
        userData.session.user.created_at ?? new Date().toISOString(),
    }
    : null;

  const avatarUrl = userData?.session?.user?.user_metadata?.avatar_url as string | undefined;

  return {
    user: userData?.profile || userFallback,
    session: userData?.session,
    avatarUrl: avatarUrl ?? null,
    /** True if the session or user profile is being fetched. */
    isLoading,
    /** True if an error occurred during fetching. */
    isError,
    /** The error object, if an error occurred. */
    error,
    /** A boolean flag indicating if the user is logged in. */
    isAuthenticated: !!userData?.session?.user,
    /** The unique ID of the authenticated user. */
    userId: userData?.session?.user?.id,
    /** Function to update the user's profile. */
    updateUser,
    /** Async version of updateUser. */
    updateUserAsync,
    /** True if the user profile update is in progress. */
    isUpdating,
    /** Function to sign the user out. */
    signOut,
    /** Async version of signOut. */
    signOutAsync,
    /** True if the sign-out process is in progress. */
    isSigningOut,
  };
};
