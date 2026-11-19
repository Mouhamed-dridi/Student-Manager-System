import { useEffect, useState, useSyncExternalStore } from "react";
import {
  errorMessage,
  getCachedSettings,
  getSettings,
  saveLicenseActivation,
  subscribeToTable,
  type AppSettings,
} from "./api";
import {
  INVALID_LICENSE_KEY_MESSAGE,
  LICENSE_STATUS_ACTIVE,
  licenseDaysRemaining,
  licenseExpiryForKey,
  licensePlanLabel,
  parseLicenseKey,
} from "./license";

/**
 * App-wide license state, read from `center_settings` row id = 1.
 *
 * Same module-store pattern as `theme.ts` / `branding.ts` / `i18n.ts`: the lock
 * screen in `App.tsx` and the License tab read one snapshot, so activating a
 * key anywhere unlocks the app everywhere without a reload. The store is primed
 * from the synchronous localStorage settings cache, then corrected by
 * `refreshLicense()` (DB read) and by the `center_settings` realtime channel.
 */

export interface LicenseSnapshot {
  /** The activated key, stored as normalized upper-case. */
  licenseKey: string;
  /** Plan label: "1 Month" | "3 Months" | "1 Year". */
  plan: string;
  /** Stored `license_status` ("Active" once a key has been applied). */
  status: string;
  /** ISO timestamp of `center_settings.license_expires_at`, or "". */
  expiresAt: string;
  /** False until the first read settles; the gate shows a verifying screen. */
  loaded: boolean;
  /** Last read/activation failure, surfaced on the lock screen. */
  error: string | null;
}

function snapshotFromSettings(settings: AppSettings): LicenseSnapshot {
  return {
    licenseKey: settings.licenseKey ?? "",
    plan: settings.licensePlan ?? "",
    status: settings.licenseStatus ?? "",
    expiresAt: settings.licenseExpiresAt ?? "",
    loaded: false,
    error: null,
  };
}

// Cached values render instantly; `loaded` stays false until the DB answers, so
// an expired cache never flashes the workspace for a moment before locking.
let current: LicenseSnapshot = snapshotFromSettings(getCachedSettings());

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): LicenseSnapshot {
  return current;
}

function publish(next: LicenseSnapshot): void {
  current = next;
  for (const listener of listeners) listener();
}

/** Publishes the license columns of an already-loaded settings object. */
export function setLicenseFromSettings(settings: AppSettings): void {
  publish({ ...snapshotFromSettings(settings), loaded: true, error: null });
}

let inFlight: Promise<void> | null = null;

// Bumped by every local activation. A read that was already in flight when the
// key was written resolves with the old row, so its result is discarded instead
// of re-locking the app right after a successful activation.
let mutationVersion = 0;

/**
 * Re-reads `center_settings` row id = 1. Concurrent calls share one request
 * (boot, the gate effect and a realtime event can overlap). A failed read keeps
 * the cached values but records the error so the lock screen can explain it.
 */
export function refreshLicense(): Promise<void> {
  if (inFlight) return inFlight;
  const version = mutationVersion;
  inFlight = getSettings()
    .then((settings) => {
      if (version !== mutationVersion) return;
      setLicenseFromSettings(settings);
    })
    .catch((error: unknown) => {
      publish({ ...current, loaded: true, error: errorMessage(error) });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface LicenseActivationResult {
  ok: boolean;
  /** Present when `ok`: the normalized key that was stored. */
  key?: string;
  /** Present when `ok`: the plan label that was stored. */
  plan?: string;
  /** Present when `ok`: the ISO expiry that was stored. */
  expiresAt?: string;
  /** Present when the key was rejected or the write failed. */
  error?: string;
}

/**
 * Validates a key, computes its expiry from the prefix's term and writes the
 * four license columns. Returns a result union instead of throwing so the lock
 * screen and the License tab can both render the message inline.
 */
export async function activateLicenseKey(
  rawKey: string,
): Promise<LicenseActivationResult> {
  const parsed = parseLicenseKey(rawKey);
  if (!parsed) return { ok: false, error: INVALID_LICENSE_KEY_MESSAGE };

  const expiry = licenseExpiryForKey(parsed.key);
  if (!expiry) return { ok: false, error: INVALID_LICENSE_KEY_MESSAGE };

  const expiresAt = expiry.toISOString();
  try {
    await saveLicenseActivation({
      licenseKey: parsed.key,
      licensePlan: parsed.plan.label,
      licenseStatus: LICENSE_STATUS_ACTIVE,
      licenseExpiresAt: expiresAt,
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  mutationVersion += 1;

  publish({
    licenseKey: parsed.key,
    plan: parsed.plan.label,
    status: LICENSE_STATUS_ACTIVE,
    expiresAt,
    loaded: true,
    error: null,
  });

  return { ok: true, key: parsed.key, plan: parsed.plan.label, expiresAt };
}

export interface LicenseState extends LicenseSnapshot {
  /** Whole days left, recomputed every minute and on tab focus. */
  daysRemaining: number;
  /** True when no usable expiry exists or it has already passed. */
  locked: boolean;
  planLabel: string;
}

/**
 * Reactive license state with a live remaining-days count. Re-checks the row
 * when the tab regains focus and keeps the countdown honest while the app stays
 * open across midnight.
 */
export function useLicense(): LicenseState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 60_000);
    const onVisibilityChange = () => {
      if (document.hidden) return;
      tick();
      void refreshLicense();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const daysRemaining = licenseDaysRemaining(snapshot.expiresAt, now);
  return {
    ...snapshot,
    daysRemaining,
    locked: daysRemaining <= 0,
    planLabel: licensePlanLabel(snapshot.plan),
  };
}

/**
 * Subscribes to `center_settings` (in the realtime publication once
 * `supabase/center-settings-realtime-migration.sql` has been run) so a key
 * activated in another tab unlocks or locks this one immediately.
 * Returns the unsubscribe function for `useEffect` cleanup.
 */
export function watchLicenseChanges(): () => void {
  return subscribeToTable("center_settings", () => {
    void refreshLicense();
  });
}
