import { TypeDatabase } from "@/types/TypeSupabase";
import { createBrowserClient } from "@supabase/ssr";

import { SupabaseClient } from "@supabase/supabase-js";

export const supabaseBrowserClient = (): SupabaseClient<TypeDatabase> =>
  createBrowserClient<TypeDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
