"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@/data/supabase/client";
import { TypeUser } from "@/types/database";
import { Session } from "@supabase/supabase-js";
import { QUERY_KEYS } from "@/config/constants";

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
        .from("users")
        .select("id, email, name, created_at")
        .eq("id", user.id)
        .single<TypeUser>();

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
      queryClient.setQueryData(
        QUERY_KEYS.USER,
        (oldData: { session: Session | null; profile: TypeUser | null } | null) => ({
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

  const userFallback: TypeUser | null = userData?.session?.user
    ? {
        id: userData.session.user.id,
        email: userData.session.user.email ?? "",
        name: userData.session.user.user_metadata?.full_name ?? "",
        created_at: userData.session.user.created_at ?? new Date().toISOString(),
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
