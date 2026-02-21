import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Single shared instance — session is persisted in localStorage
const client = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  }
);

export function createClient() {
  return client;
}
