import { TypeDatabase } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

export const supabaseBrowserClient = (): SupabaseClient<TypeDatabase> =>
  createBrowserClient<TypeDatabase>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
