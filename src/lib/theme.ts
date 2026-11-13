import { useSyncExternalStore } from "react";

/**
 * App-wide theme state.
 *
 * Tailwind's `dark:` variant is class-based (`@custom-variant dark (&:is(.dark *))`
 * in src/index.css), so the single source of truth is the `.dark` class on
 * <html>. This module owns that class plus the two localStorage copies:
 *
 * - `ssm-theme` is the tiny `'dark' | 'light'` value the UI reads first, so a
 *   reload paints the last chosen theme before Supabase answers.
 * - `ssm-settings.dark_mode` is the existing settings cache written by
 *   `saveSettings()`. It is kept in sync here so bootstrap (src/main.tsx) and
 *   the settings pages never disagree.
 *
 * The DB row remains the durable copy: `getSettings()` re-applies it on load.
 */

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "ssm-theme";
const SETTINGS_STORAGE_KEY = "ssm-settings";

function parseTheme(value: string | null): Theme | null {
  return value === "dark" || value === "light" ? value : null;
}

function themeFromSettingsCache(): Theme | null {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { dark_mode?: unknown };
    if (typeof parsed?.dark_mode !== "boolean") return null;
    return parsed.dark_mode ? "dark" : "light";
  } catch {
    return null;
  }
}

function initialTheme(): Theme {
  try {
    return (
      parseTheme(localStorage.getItem(THEME_STORAGE_KEY)) ??
      themeFromSettingsCache() ??
      "light"
    );
  } catch {
    return "light";
  }
}

let current: Theme = initialTheme();
const listeners = new Set<() => void>();

function applyToDocument(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  // Native controls (date/time pickers, scrollbars, form widgets) follow too.
  document.documentElement.style.colorScheme = theme;
}

function mirrorTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode/quota — the class on <html> still works for this session.
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const store =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    store.dark_mode = theme === "dark";
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The settings cache is optional; the DB write is authoritative.
  }
}

// Apply before React renders so the first paint already has the right theme.
applyToDocument(current);
mirrorTheme(current);

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Theme {
  return current;
}

/** Switches the whole app between dark and light and persists the choice. */
export function setTheme(theme: Theme): void {
  const changed = theme !== current;
  current = theme;
  applyToDocument(theme);
  mirrorTheme(theme);
  if (changed) for (const listener of listeners) listener();
}

/** Reactive theme value; re-renders when any settings page toggles it. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
