/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Legacy anon key format (eyJ…). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** New publishable key format (sb_publishable_…). Either one works. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
