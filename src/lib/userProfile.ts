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

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getUserProfile,
  hasUserProfilesTable,
  listUserProfiles,
  upsertUserProfile,
  type UserProfile,
  type UserProfileRole,
} from "./api";

const PROFILE_EVENT = "ssm-user-profile-changed";

const cache = new Map<string, UserProfile | null>();
const pending = new Map<string, Promise<UserProfile | null>>();

// One extra cache: all rows of a role, fetched once for the people tables so a
// list of 200 students still costs one request. Kept in step with the per-person
// cache below, so an upload in Settings also updates the table.
const roleCache = new Map<UserProfileRole, UserProfile[]>();
const rolePending = new Map<UserProfileRole, Promise<UserProfile[]>>();
const EMPTY_ROLE_PROFILES: UserProfile[] = [];

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
  const rows = roleCache.get(profile.role);
  if (rows) {
    roleCache.set(profile.role, [
      ...rows.filter((row) => row.userId !== profile.userId),
      profile,
    ]);
  }
  emit(key);
}

/**
 * Fetches every row of a role once (concurrent callers share the request).
 * Failures are not cached, so the next mount retries.
 */
export async function loadAllUserProfiles(
  role: UserProfileRole,
): Promise<UserProfile[]> {
  const cached = roleCache.get(role);
  if (cached) return cached;
  const inFlight = rolePending.get(role);
  if (inFlight) return inFlight;

  const request = listUserProfiles(role)
    .then((rows) => {
      roleCache.set(role, rows);
      // Seed the per-person cache as well: `useUserProfile` reads it directly,
      // and a profile page opened from a people table (which only fetched the
      // role list) would otherwise show initials until its own request lands.
      for (const row of rows) {
        const key = userProfileCacheKey(role, row.userId);
        if (!cache.get(key)) cache.set(key, row);
        emit(key);
      }
      emit(`all:${role}`);
      return rows;
    })
    .finally(() => {
      rolePending.delete(role);
    });
  rolePending.set(role, request);
  return request;
}

/** Drops a cached row (used when the signed-in person changes). */
export function forgetUserProfile(
  role: UserProfileRole,
  userId?: string,
): void {
  if (!userId) return;
  cache.delete(userProfileCacheKey(role, userId));
}

/**
 * Reactive `user_id -> profile` map for one role: the avatar/name lookup the
 * operator's Students and Teachers tables read per row. The initial load is
 * started here, and any profile save refreshes every mounted consumer through
 * the same event the portal headers listen to.
 */
export function useUserProfiles(
  role: UserProfileRole | undefined,
): Map<string, UserProfile> {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(PROFILE_EVENT, onChange);
    return () => window.removeEventListener(PROFILE_EVENT, onChange);
  }, []);

  const getSnapshot = useCallback(
    () => (role ? (roleCache.get(role) ?? EMPTY_ROLE_PROFILES) : EMPTY_ROLE_PROFILES),
    [role],
  );

  const rows = useSyncExternalStore(subscribe, getSnapshot, () =>
    EMPTY_ROLE_PROFILES,
  );

  // Loading writes into the module cache and emits, which re-reads the
  // snapshot above; nothing is set from here.
  useEffect(() => {
    if (!role) return;
    void loadAllUserProfiles(role).catch(() => null);
  }, [role]);

  return useMemo(
    () => new Map(rows.map((row) => [row.userId, row])),
    [rows],
  );
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

  const getSnapshot = useCallback(() => {
    if (!key || !role || !userId) return null;
    const direct = cache.get(key);
    if (direct) return direct;
    // Fall back to the role-wide list: the people tables fetch every profile in
    // one request, so a profile page opened from them can show the stored photo
    // before this person's own request settles (instead of flashing initials).
    return roleCache.get(role)?.find((row) => row.userId === userId) ?? null;
  }, [key, role, userId]);

  // Portal headers and settings pages fetch the signed-in person's row
  // themselves, but a profile page opened by the operator never did — so the
  // cache stayed empty and `avatar_url` was never loaded. Fetching here makes
  // the hook self-sufficient; `loadUserProfile` de-duplicates requests and
  // caches "no row yet", so this costs one request per person at most.
  useEffect(() => {
    if (!role || !userId) return;
    void loadUserProfile(role, userId).catch(() => null);
  }, [role, userId]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
