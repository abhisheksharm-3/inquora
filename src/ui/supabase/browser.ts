import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/core/database.types";

/**
 * The browser Supabase client, for the session and for reads a component makes
 * directly. It carries the anon key, so row-level security is what protects the
 * data — which is why every table has a policy rather than relying on the client
 * asking nicely.
 *
 * The environment is read straight from process.env here rather than through the
 * server's schema: these two values are inlined at build time, and the server
 * schema imports things that do not belong in a browser bundle.
 */
export const supabaseBrowserClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
