import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-safe Supabase singleton using the public anon key.
// Used for Realtime subscriptions only — never exposes the service role key.
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  _client = createClient(url, key);
  return _client;
}
