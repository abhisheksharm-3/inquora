"use client";

import type { Database } from "@/core/database.types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/ui/supabase/browser";
import { Session } from "@supabase/supabase-js";

/** The one cache key this hook owns. It lived in a config module that held nine
 * unrelated things, most of them for code that no longer exists. */
const QUERY_KEYS = { USER: ["user"] as const };

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const useUser = () => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();

  const {
    data: userData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.USER,
    queryFn: async () => {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();
      if (sessionError) throw sessionError;
      if (!user) return { session: null, profile: null };

      const session = { user };
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, created_at")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      return { session, profile };
    },
  });

  const {
    mutate: updateUser,
    mutateAsync: updateUserAsync,
    isPending: isUpdating,
  } = useMutation({
    mutationFn: async (updatedData: { display_name?: string | null }) => {
      if (!userData?.session?.user) throw new Error("User not authenticated.");

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(updatedData)
        .eq("id", userData.session.user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(
        QUERY_KEYS.USER,
        (oldData: { session: Session | null; profile: Profile | null } | null) => ({
          ...oldData,
          profile: updatedProfile,
        }),
      );
    },
  });

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
      queryClient.setQueryData(QUERY_KEYS.USER, null);
    },
  });

  // A profile row always exists for an authenticated user, because the
  // on_auth_user_created trigger writes it. This fallback covers the gap between
  // sign-up and the first read of it.
  const userFallback: Profile | null = userData?.session?.user
    ? {
        id: userData.session.user.id,
        display_name:
          (userData.session.user.user_metadata?.full_name as string | undefined) ?? null,
        created_at: userData.session.user.created_at ?? new Date().toISOString(),
        updated_at: userData.session.user.created_at ?? new Date().toISOString(),
      }
    : null;

  const avatarUrl = userData?.session?.user?.user_metadata?.avatar_url as string | undefined;

  return {
    user: userData?.profile || userFallback,
    session: userData?.session,
    avatarUrl: avatarUrl ?? null,
    isLoading,
    isError,
    error,
    isAuthenticated: !!userData?.session?.user,
    userId: userData?.session?.user?.id,
    updateUser,
    updateUserAsync,
    isUpdating,
    signOut,
    signOutAsync,
    isSigningOut,
  };
};
