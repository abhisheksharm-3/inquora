"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "@/ui/supabase/browser";
import type { Database } from "@/core/database.types";

type SupabaseContextType = SupabaseClient<Database>;

const SupabaseContext = createContext<SupabaseContextType | null>(null);

interface SupabaseProviderProps {
  children: ReactNode;
}

/**
 * Provides a single Supabase client instance to the entire application.
 * Prevents duplicate client creation across hooks and components.
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);

  return <SupabaseContext value={supabase}>{children}</SupabaseContext>;
}

/**
 * Hook to access the Supabase client from context.
 * @throws If used outside of SupabaseProvider
 */
export function useSupabase(): SupabaseClient<Database> {
  const context = useContext(SupabaseContext);

  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }

  return context;
}
