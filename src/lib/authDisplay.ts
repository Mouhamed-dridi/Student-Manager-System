import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function nameFromAuthUser(user: unknown): string | null {
  if (!user) return null;
  const u = user as {
    user_metadata?: Record<string, unknown>;
    email?: string | null;
    phone?: string | null;
  };
  for (const key of ["name", "full_name", "display_name"]) {
    const value = u.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const email = u.email?.trim();
  if (email) {
    const handle = email.split("@")[0];
    return handle || email;
  }
  const phone = u.phone?.trim();
  if (phone) return phone;
  return null;
}

/**
 * Resolves the current Supabase auth user's display name (user_metadata.name
 * preferred, falling back to the email handle / phone), or `fallback` when no
 * auth session exists — the app's operator login (admin/admin123) has no
 * Supabase account, so it always lands on the fallback.
 */
export function useAuthDisplayName(fallback: string): string {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setName(nameFromAuthUser(data.user));
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return name ?? fallback;
}