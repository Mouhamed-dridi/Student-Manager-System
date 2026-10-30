// Live cache for `user_profiles` rows, shared by the settings pages and the
// portal shells.
//
// The table is the server-side home of the avatar and social links (see the
// block in `api.ts`). Rendering the navbar straight from `supabase` on every
// keystroke would be wasteful, so this module keeps the last fetched row in
// memory and tells every mounted consumer to re-read it whenever a save
// succeeds. That is what makes the header avatar/name change the moment
// "Save Changes" (or an avatar upload) returns, without a page reload.
//
// `useSyncExternalStore` needs a stable snapshot, so the cache holds whole
// UserProfile objects and never mutates them in place.

import { useCallback, useSyncExternalStore } from "react";
import {
  getUserProfile,
  hasUserProfilesTable,
  upsertUserProfile,
  type UserProfile,
  type UserProfileRole,
} from "./api";

const PROFILE_EVENT = "ssm-user-profile-changed";

const cache = new Map<string, UserProfile | null>();
const pending = new Map<string, Promise<UserProfile | null>>();

export function userProfileCacheKey(
  role: UserProfileRole,
  userId: string,
): string {
  return `${role}:${userId}`;
}

function emit(key: string): void {
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { key } }));
}

/** "Ada Lovelace" from the stored parts; blank when both are empty. */
export function userProfileFullName(
  profile: UserProfile | null | undefined,
): string {
  if (!profile) return "";
  return `${profile.firstName ?? ""} ${profile.lastName ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

/** A blank profile for a person whose row does not exist yet. */
export function emptyUserProfile(
  userId: string,
  role: UserProfileRole,
  firstName = "",
  lastName = "",
): UserProfile {
  return { userId, role, firstName, lastName };
}

/**
 * Fetches the row once per app load (concurrent callers share the request) and
 * caches it, including "no row yet" as null. Rejects when the request fails so
 * callers can fall back to their localStorage mirror; failures are not cached,
 * so a later mount retries.
 */
export async function loadUserProfile(
  role: UserProfileRole,
  userId: string | undefined,
): Promise<UserProfile | null> {
  if (!userId) return null;
  const key = userProfileCacheKey(role, userId);
  if (cache.has(key)) return cache.get(key) ?? null;

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const request = getUserProfile(userId, role)
    .then((profile) => {
      cache.set(key, profile);
      emit(key);
      return profile;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, request);
  return request;
}

/**
 * Writes the row, then refreshes every consumer with the saved values. When the
 * deployment has no `user_profiles` table the write is skipped instead of
 * failing the form — the localStorage mirrors still hold the avatar/links, so
 * the profile degrades to the previous local-only behaviour.
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (await hasUserProfilesTable()) {
    await upsertUserProfile(profile);
  }
  const key = userProfileCacheKey(profile.role, profile.userId);
  cache.set(key, profile);
  emit(key);
}

/** Drops a cached row (used when the signed-in person changes). */
export function forgetUserProfile(
  role: UserProfileRole,
  userId?: string,
): void {
  if (!userId) return;
  cache.delete(userProfileCacheKey(role, userId));
}

/** Reactive profile row for one person; null while unknown or absent. */
export function useUserProfile(
  role: UserProfileRole | undefined,
  userId: string | undefined,
): UserProfile | null {
  const key = role && userId ? userProfileCacheKey(role, userId) : null;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!key) return () => {};
      const onEvent = (event: Event) => {
        const detail = (event as CustomEvent<{ key?: string }>).detail;
        if (!detail || detail.key === key) onChange();
      };
      window.addEventListener(PROFILE_EVENT, onEvent);
      return () => window.removeEventListener(PROFILE_EVENT, onEvent);
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => (key ? (cache.get(key) ?? null) : null),
    [key],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
