import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key.
// Never import this file from client components — SERVICE_ROLE_KEY must stay server-side.
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
