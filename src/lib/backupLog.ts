/**
 * Compact "Backup & Restore History" for the operator Backup & Export page.
 *
 * There is no backend table for this (no Supabase Auth, no per-user writes), so
 * the log is a localStorage list capped at the last 50 actions, newest first.
 * Entries are written by the page and by the restore wizard, and a window event
 * keeps any mounted history table in sync without a refetch.
 */

export type BackupLogAction = "backup" | "restore";
export type BackupLogStatus = "success" | "partial" | "failed";
export type BackupLogMode = "merge" | "replace";

export interface BackupLogEntry {
  id: string;
  /** ISO timestamp of the action. */
  at: string;
  action: BackupLogAction;
  /** Human label kept as data, e.g. "JSON", "SQL", "Excel". */
  format: string;
  /** Restore only. */
  mode?: BackupLogMode;
  rows: number;
  /** Restore only: rows the database rejected. */
  failures?: number;
  tables: number;
  /** Cookie role of whoever ran it; the page is operator-only. */
  performedBy: string;
  /** `safety` marks the automatic pre-restore download. */
  note?: "safety";
  status: BackupLogStatus;
}

const STORAGE_KEY = "ssm-backup-history";
const LIMIT = 50;

/** Fired after a successful append so the history table re-reads the list. */
export const BACKUP_LOG_EVENT = "ssm-backup-log-changed";

const isEntry = (value: unknown): value is BackupLogEntry => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<BackupLogEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.at === "string" &&
    (entry.action === "backup" || entry.action === "restore")
  );
};

/** Newest-first history; a corrupt or absent cache yields an empty list. */
export function loadBackupLog(): BackupLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, LIMIT);
  } catch {
    return [];
  }
}

/** The most recent backup (not restore), used for the health status block. */
export function latestBackupEntry(): BackupLogEntry | null {
  return loadBackupLog().find((entry) => entry.action === "backup") ?? null;
}

export function appendBackupLog(
  entry: Omit<BackupLogEntry, "id" | "at"> & { at?: string },
): BackupLogEntry {
  const complete: BackupLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
  };
  const next = [complete, ...loadBackupLog()].slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full / disabled: the action itself already succeeded.
  }
  window.dispatchEvent(new Event(BACKUP_LOG_EVENT));
  return complete;
}
