import type { RecipientType } from "@/pages/publications/publicationTypes";

// Per-role record of announcement ids the user has opened. Stored in
// localStorage (like the settings fallback cache) because there is no
// per-user backend here; a custom event lets the sidebar badge update the
// moment the announcements page marks the list read.

const READ_EVENT = "ssm-announcements-read";
const KEY_PREFIX = "ssm-read-announcements-";

function keyFor(role: RecipientType): string {
  return `${KEY_PREFIX}${role}`;
}

export function getReadAnnouncementIds(role: RecipientType): Set<string> {
  try {
    const raw = localStorage.getItem(keyFor(role));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Marks the given ids read for the role and notifies listeners (sidebar). */
export function markAnnouncementsRead(
  role: RecipientType,
  ids: string[],
): void {
  if (ids.length === 0) return;
  try {
    const merged = getReadAnnouncementIds(role);
    let changed = false;
    for (const id of ids) {
      if (!merged.has(id)) {
        merged.add(id);
        changed = true;
      }
    }
    if (!changed) return;
    localStorage.setItem(keyFor(role), JSON.stringify([...merged]));
    window.dispatchEvent(new Event(READ_EVENT));
  } catch {
    // Storage unavailable — the badge just keeps its previous value.
  }
}

/** Subscribes to read-state changes (same tab and other tabs). */
export function onAnnouncementsRead(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(KEY_PREFIX)) listener();
  };
  window.addEventListener(READ_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(READ_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
