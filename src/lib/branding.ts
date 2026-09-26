import { useSyncExternalStore } from "react";
import { type AppSettings, getCachedSettings } from "./api";

export interface Branding {
  systemName: string;
  universityName: string;
  /** University logo URL from the `logo_url` setting, or "" when unset. */
  logoUrl: string;
}

const DEFAULT_SYSTEM_NAME = "SSM";

function fromSettings(settings: AppSettings): Branding {
  return {
    systemName: settings.systemName?.trim() || DEFAULT_SYSTEM_NAME,
    universityName: settings.universityName?.trim() || "",
    logoUrl: settings.logoUrl?.trim() || "",
  };
}

let current: Branding = fromSettings(getCachedSettings());

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Branding {
  return current;
}

function publish(next: Branding): void {
  current = next;
  for (const listener of listeners) listener();
}

/** Updates the in-memory branding after a settings read/save. */
export function setBrandingFromSettings(settings: AppSettings): void {
  publish(fromSettings(settings));
}

/**
 * Reactive hook: re-renders the consumer whenever branding changes.
 * `getServerSnapshot` is required by useSyncExternalStore whenever there is no
 * browser store, i.e. any server render of a screen that uses branding.
 */
export function useBranding(): Branding {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Combined label for the top bar; defaults to the full product name. */
export function brandTitle(branding: Branding): string {
  const system = branding.systemName === DEFAULT_SYSTEM_NAME ? null : branding.systemName;
  const parts = [branding.universityName, system].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Student Manager System";
}