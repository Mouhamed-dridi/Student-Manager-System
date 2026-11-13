import {
  fetchCenterExportSnapshot,
  markCenterBackupDone,
  type CenterExportSnapshot,
} from "@/lib/api";

/**
 * Full-database JSON / CSV export behind Settings > Backup & Export.
 *
 * Fetches the center's core tables (students, teachers, branches,
 * branch_materials, absence_billets) through `@/lib/api`, builds the file text
 * here, triggers the browser download and finally stamps `last_backup_at` on
 * `center_settings` row id = 1.
 */

export type CenterExportFormat = "json" | "csv";

export interface CenterExportResult {
  rows: number;
  skipped: { table: string; message: string }[];
  /** The `last_backup_at` stamp written to center_settings. */
  at: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export const centerExportFileName = (format: CenterExportFormat) =>
  `center-database-${today()}.${format}`;

/** The download file every full-database export produces. */
export function buildCenterExportJson(snapshot: CenterExportSnapshot): string {
  return `${JSON.stringify(
    {
      generated_at: snapshot.generatedAt,
      tables: Object.fromEntries(
        snapshot.tables.map((entry) => [entry.table, entry.rows]),
      ),
      skipped: snapshot.skipped,
    },
    null,
    2,
  )}\n`;
}

/**
 * One CSV for every table: a leading `table` column keeps the sections apart
 * (same convention as the multi-table Excel export). Columns are the union
 * across all rows so ragged rows keep their place; objects (jsonb/arrays) are
 * written as their JSON text.
 */
export function buildCenterExportCsv(snapshot: CenterExportSnapshot): string {
  const columns = Array.from(
    new Set(
      snapshot.tables.flatMap((entry) =>
        entry.rows.flatMap((row) => Object.keys(row)),
      ),
    ),
  );

  const cell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [["table", ...columns].map(cell).join(",")];
  for (const entry of snapshot.tables) {
    for (const row of entry.rows) {
      lines.push(
        [
          entry.table,
          ...columns.map((column) => {
            // A row from another table has no such column: leave it blank.
            return Object.prototype.hasOwnProperty.call(row, column)
              ? row[column]
              : "";
          }),
        ]
          .map(cell)
          .join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function downloadText(fileName: string, content: string, mime: string): void {
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

/** Fetches, downloads and stamps the backup timestamp. */
export async function runCenterExport(
  format: CenterExportFormat,
): Promise<CenterExportResult> {
  const snapshot = await fetchCenterExportSnapshot();
  const rows = snapshot.tables.reduce(
    (sum, entry) => sum + entry.rows.length,
    0,
  );
  downloadText(
    centerExportFileName(format),
    format === "json"
      ? buildCenterExportJson(snapshot)
      : buildCenterExportCsv(snapshot),
    format === "json" ? "application/json" : "text/csv",
  );
  const at = new Date().toISOString();
  await markCenterBackupDone(at);
  return { rows, skipped: snapshot.skipped, at };
}
