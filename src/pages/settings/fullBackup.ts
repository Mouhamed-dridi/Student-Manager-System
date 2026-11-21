import {
  errorMessage,
  listBackupRows,
  markCenterBackupDone,
  type BackupTableName,
} from "@/lib/api";
import {
  FULL_BACKUP_TABLES,
  generateFullBackupDocument,
  withoutDeletedRows,
  type BackupSection,
} from "@/pages/settings/backupFormat";

/**
 * Full System Backup behind Settings > Backup & Export.
 *
 * One snapshot of every core table, downloaded as a single JSON document
 * (recommended for restore) or one SQL script. A table this database does not
 * have yet (`operators`, `payment_history`, optional migrations) lands in
 * `skipped` instead of failing the whole backup, and the download finally
 * stamps `last_backup_at` on `center_settings` row id = 1.
 */

export type FullBackupFormat = "json" | "sql";

export interface FullBackupSnapshot {
  generatedAt: string;
  includeDeleted: boolean;
  tables: BackupSection[];
  skipped: { table: BackupTableName; message: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** True once the last backup is more than seven days old. */
export function isBackupOverdue(at: string | null | undefined): boolean {
  if (!at) return false;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return false;
  return Date.now() - time > STALE_AFTER_MS;
}

export const fullBackupFileName = (format: FullBackupFormat) =>
  `ssm-full-backup-${today()}.${format}`;

/** Fetches every core table once; failures are collected, never thrown. */
export async function fetchFullBackupSnapshot(
  includeDeleted: boolean,
): Promise<FullBackupSnapshot> {
  const results = await Promise.allSettled(
    FULL_BACKUP_TABLES.map((table) => listBackupRows(table)),
  );
  const tables: BackupSection[] = [];
  const skipped: FullBackupSnapshot["skipped"] = [];
  results.forEach((result, index) => {
    const table = FULL_BACKUP_TABLES[index];
    if (result.status === "fulfilled") {
      tables.push({
        table,
        rows: includeDeleted ? result.value : withoutDeletedRows(result.value),
      });
    } else {
      skipped.push({ table, message: errorMessage(result.reason as unknown) });
    }
  });
  return {
    generatedAt: new Date().toISOString(),
    includeDeleted,
    tables,
    skipped,
  };
}

/**
 * The restore-ready document: `tables` is keyed by real table name, so the
 * restore wizard can count and write each table without guessing.
 */
export function buildFullBackupJson(snapshot: FullBackupSnapshot): string {
  return `${JSON.stringify(
    {
      app: "SSM",
      kind: "full-backup",
      version: 1,
      generated_at: snapshot.generatedAt,
      include_deleted: snapshot.includeDeleted,
      tables: Object.fromEntries(
        snapshot.tables.map((entry) => [entry.table, entry.rows]),
      ),
      skipped: snapshot.skipped,
    },
    null,
    2,
  )}\n`;
}

export function buildFullBackupSql(snapshot: FullBackupSnapshot): string {
  const skippedComment = snapshot.skipped.length
    ? `-- Skipped tables: ${snapshot.skipped
        .map((entry) => entry.table)
        .join(", ")}\n`
    : "";
  return `${skippedComment}${generateFullBackupDocument(snapshot.tables)}`;
}

export function downloadBackupFile(
  fileName: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface FullBackupResult {
  at: string;
  rows: number;
  tables: number;
  fileName: string;
  skipped: FullBackupSnapshot["skipped"];
}

/** Fetches, downloads and stamps one full backup. */
export async function runFullBackup(
  format: FullBackupFormat,
  includeDeleted: boolean,
): Promise<FullBackupResult> {
  const snapshot = await fetchFullBackupSnapshot(includeDeleted);
  const rows = snapshot.tables.reduce(
    (sum, entry) => sum + entry.rows.length,
    0,
  );
  const fileName = fullBackupFileName(format);
  downloadBackupFile(
    fileName,
    format === "json"
      ? buildFullBackupJson(snapshot)
      : buildFullBackupSql(snapshot),
    format === "json" ? "application/json" : "text/plain",
  );
  const at = new Date().toISOString();
  await markCenterBackupDone(at);
  return {
    at,
    rows,
    tables: snapshot.tables.length,
    fileName,
    skipped: snapshot.skipped,
  };
}
