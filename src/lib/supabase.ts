import { createClient } from "@supabase/supabase-js";

// Accepts either the legacy anon key or the newer publishable key format.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase is not configured. Copy .env.example to .env.local, fill in VITE_SUPABASE_URL and your anon/publishable key, then restart the dev server.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
