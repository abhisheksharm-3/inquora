import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/core/database.types";

/**
 * The server-side Supabase client, bound to the request's cookies so row-level
 * security sees the calling user.
 *
 * The previous code reached for the browser client inside server paths
 * (src/utils/file-processing-utils.ts:26), which ran as the anonymous role
 * regardless of who was asking.
 */
export async function createServerDbClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // middleware in src/proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
