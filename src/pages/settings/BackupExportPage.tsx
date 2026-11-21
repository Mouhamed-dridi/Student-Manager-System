import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { errorMessage, getSettings, markCenterBackupDone } from "@/lib/api";
import {
  BACKUP_LOG_EVENT,
  appendBackupLog,
  loadBackupLog,
  type BackupLogEntry,
} from "@/lib/backupLog";
import { useI18n } from "@/lib/i18n";
import { getRole } from "@/lib/session";
import RestoreDataModal from "./RestoreDataModal";
import {
  BACKUP_SOURCES,
  FULL_BACKUP_TABLES,
  TABLE_LABELS,
  backupFileName,
  fetchSourceSections,
  generateSqlDocument,
  sourceRowCount,
  withoutDeletedSections,
  workbookBytesForSections,
} from "./backupFormat";
import {
  downloadBackupFile,
  isBackupOverdue,
  runFullBackup,
  type FullBackupFormat,
} from "./fullBackup";

const CARD =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
const MUTED_TEXT = "text-zinc-500 dark:text-zinc-400";
const HAIRLINE = "border-zinc-200 dark:border-zinc-800";

/** The role that ran the action, rendered through the dictionary. */
function performedByLabel(value: string, t: (key: string) => string): string {
  return value === "operator" ? t("Operator") : value || "—";
}

export function BackupExportPage() {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({});
  const [loadingSource, setLoadingSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [format, setFormat] = useState<FullBackupFormat>("json");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [fullExporting, setFullExporting] = useState(false);
  const [fetchedBackupAt, setFetchedBackupAt] = useState("");
  const [exportedBackupAt, setExportedBackupAt] = useState("");
  const [history, setHistory] = useState<BackupLogEntry[]>(() =>
    loadBackupLog(),
  );

  const isAdmin = getRole() === "operator";
  const performedBy = getRole() ?? "operator";

  // Read from the settings row once; after an export the local stamp wins so
  // the indicator updates without a refetch.
  const lastBackup = exportedBackupAt || fetchedBackupAt;

  const refreshHistory = useCallback(() => {
    setHistory(loadBackupLog());
  }, []);

  const loadCounts = useCallback(() => {
    let cancelled = false;
    void Promise.all(
      BACKUP_SOURCES.map(async (source) => {
        try {
          const count = await sourceRowCount(source.key);
          if (!cancelled) setCounts((prev) => ({ ...prev, [source.key]: count }));
        } catch {
          // Counts are decorative; the export itself reports real errors.
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled) setFetchedBackupAt(settings.lastBackupAt ?? "");
      })
      .catch(() => {
        // Optional schema / offline: the indicator stays "never backed up".
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    window.addEventListener(BACKUP_LOG_EVENT, refreshHistory);
    return () => {
      window.removeEventListener(BACKUP_LOG_EVENT, refreshHistory);
    };
  }, [isAdmin, refreshHistory]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    return loadCounts();
  }, [isAdmin, loadCounts]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  if (!isAdmin) {
    return (
      <div className={`${CARD} flex items-center gap-3 px-5 py-8`}>
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{t("Admin access required")}</p>
          <p className={`text-sm ${MUTED_TEXT}`}>
            {t("Backup & Export is restricted to operator accounts.")}
          </p>
        </div>
      </div>
    );
  }

  /** Records the download on `center_settings.last_backup_at`. */
  const stampBackup = async (at: string) => {
    setExportedBackupAt(at);
    await markCenterBackupDone(at);
  };

  const handleFullExport = async () => {
    setFullExporting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // runFullBackup already stamps `last_backup_at`; just mirror it locally.
      const result = await runFullBackup(format, includeDeleted);
      setExportedBackupAt(result.at);
      appendBackupLog({
        action: "backup",
        format: format === "json" ? "JSON" : "SQL",
        rows: result.rows,
        tables: result.tables,
        performedBy,
        status: result.skipped.length > 0 ? "partial" : "success",
      });
      refreshHistory();
      const skipped = result.skipped.length
        ? ` ${t("Skipped:")} ${result.skipped
            .map((entry) => t(TABLE_LABELS[entry.table]))
            .join(", ")}.`
        : "";
      setSuccessMessage(
        `${t("Full system backup downloaded")} (${format.toUpperCase()}, ${t("{count} rows", {
          count: result.rows,
        })}).${skipped}`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFullExporting(false);
    }
  };

  const handleModuleExport = async (
    sourceKey: string,
    kind: "sql" | "excel",
  ) => {
    const source = BACKUP_SOURCES.find((entry) => entry.key === sourceKey);
    if (!source) return;
    setLoadingSource(sourceKey);
    setError(null);
    setSuccessMessage(null);
    try {
      const fetched = await fetchSourceSections(sourceKey);
      // Excel is a human-readable sheet, so trashed rows never go in it.
      const sections =
        kind === "excel" || !includeDeleted
          ? withoutDeletedSections(fetched)
          : fetched;
      const rows = sections.reduce((sum, section) => sum + section.rows.length, 0);
      if (kind === "sql") {
        downloadBackupFile(
          backupFileName(sourceKey, "sql"),
          generateSqlDocument(source.label, sections),
          "text/plain",
        );
      } else {
        const blob = new Blob([workbookBytesForSections(sections)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = backupFileName(sourceKey, "xlsx");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      const at = new Date().toISOString();
      await stampBackup(at);
      appendBackupLog({
        action: "backup",
        format: kind === "sql" ? "SQL" : "Excel",
        rows,
        tables: source.tables.length,
        performedBy,
        status: "success",
      });
      refreshHistory();
      setSuccessMessage(
        `${t(source.label)} ${t("exported as")} ${
          kind === "sql" ? "SQL" : "Excel"
        } (${t("{count} rows", { count: rows })}).`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingSource(null);
    }
  };

  const hasBackup =
    Boolean(lastBackup) && !Number.isNaN(Date.parse(lastBackup));
  const isStale = isBackupOverdue(lastBackup);
  const lastBackupEntry =
    history.find((entry) => entry.action === "backup") ?? null;

  const healthValue = !hasBackup
    ? t("Never backed up")
    : isStale
      ? t("Older than 7 days")
      : t("Healthy");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{t("Backup & Export")}</h2>
          <p className={`mt-1 max-w-2xl text-sm ${MUTED_TEXT}`}>
            {t(
              "Download a complete copy of your center's data as JSON or SQL, export a single module, or restore a previous backup.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => setRestoreOpen(true)}>
          <Upload className="h-4 w-4" />
          {t("Restore / Import Data")}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${HAIRLINE}`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${HAIRLINE}`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------ full system backup */}
      <section className={CARD}>
        <header className={`border-b px-5 py-4 ${HAIRLINE}`}>
          <div className="flex flex-wrap items-center gap-2">
            <DatabaseBackup className="h-4 w-4" />
            <h3 className="text-sm font-semibold tracking-wide uppercase">
              {t("Full System Backup")}
            </h3>
            <span
              className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${HAIRLINE} ${MUTED_TEXT}`}
            >
              {t("{count} tables", { count: FULL_BACKUP_TABLES.length })}
            </span>
          </div>
          <p className={`mt-1 text-sm ${MUTED_TEXT}`}>
            {t(
              "One file with every core table: students, teachers, operators, branches, materials, payments, attendance, billets, planning, exams, publications, events and center settings.",
            )}
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: "json" as FullBackupFormat,
                  icon: <FileJson className="h-4 w-4" />,
                  title: t("JSON"),
                  hint: t("Recommended for restore"),
                },
                {
                  value: "sql" as FullBackupFormat,
                  icon: <FileText className="h-4 w-4" />,
                  title: t("SQL script"),
                  hint: t("INSERT statements for psql or the SQL editor"),
                },
              ] as const
            ).map((option) => {
              const selected = format === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFormat(option.value)}
                  className={
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors " +
                    (selected
                      ? "border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-800"
                      : `${HAIRLINE} hover:bg-zinc-50 dark:hover:bg-zinc-900`)
                  }
                >
                  <span className="mt-0.5">{option.icon}</span>
                  <span>
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className={`block text-xs ${MUTED_TEXT}`}>
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5 ${HAIRLINE}`}
          >
            <div>
              <p className="text-sm font-medium">
                {t("Include deleted (Trash) records")}
              </p>
              <p className={`mt-0.5 text-xs ${MUTED_TEXT}`}>
                {t(
                  "SQL and JSON backups keep trashed rows so a restore can bring them back. Excel exports never include them.",
                )}
              </p>
            </div>
            <Switch
              checked={includeDeleted}
              onCheckedChange={setIncludeDeleted}
              aria-label={t("Include deleted (Trash) records")}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FULL_BACKUP_TABLES.map((table) => (
              <span
                key={table}
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${HAIRLINE} ${MUTED_TEXT}`}
              >
                {t(TABLE_LABELS[table])}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleFullExport} disabled={fullExporting}>
              {fullExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DatabaseBackup className="h-4 w-4" />
              )}
              {t("Export Full System Backup")}
            </Button>
            <span className={`text-xs ${MUTED_TEXT}`}>
              {format === "json"
                ? t("Restores through the wizard on this page.")
                : t("Best for manual review and SQL console imports.")}
            </span>
          </div>

          {/* ------------------------------------------------- health status */}
          <div
            className={`grid gap-3 rounded-lg border px-3 py-3 sm:grid-cols-3 ${HAIRLINE}`}
          >
            <div>
              <p className={`text-[10px] font-medium tracking-wide uppercase ${MUTED_TEXT}`}>
                {t("Last backup")}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                {hasBackup
                  ? new Date(lastBackup).toLocaleString()
                  : t("Never backed up")}
              </p>
            </div>
            <div>
              <p className={`text-[10px] font-medium tracking-wide uppercase ${MUTED_TEXT}`}>
                {t("Performed by")}
              </p>
              <p className="mt-0.5 text-sm font-medium">
                {lastBackupEntry
                  ? performedByLabel(lastBackupEntry.performedBy, t)
                  : hasBackup
                    ? performedByLabel(performedBy, t)
                    : "—"}
              </p>
            </div>
            <div>
              <p className={`text-[10px] font-medium tracking-wide uppercase ${MUTED_TEXT}`}>
                {t("Status")}
              </p>
              <p className="mt-0.5 text-sm font-medium">{healthValue}</p>
            </div>
            {isStale && (
              <p
                className={`flex items-start gap-2 text-xs sm:col-span-3 ${MUTED_TEXT}`}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t(
                  "No backup in the last 7 days. Download a fresh Full System Backup before your next changes.",
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- per-module cards */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            {t("Module backups")}
          </h3>
          <p className={`mt-1 text-sm ${MUTED_TEXT}`}>
            {t(
              "Every module downloads as a SQL script or an Excel workbook. Use these for a single table instead of the full backup.",
            )}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {BACKUP_SOURCES.map((source) => (
            <div key={source.key} className={`${CARD} flex flex-col p-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">{t(source.label)}</h4>
                <span className={`text-xs ${MUTED_TEXT}`}>
                  {counts[source.key] === undefined
                    ? "—"
                    : t("{count} rows", { count: counts[source.key] ?? 0 })}
                </span>
              </div>
              <p className={`mt-1 flex-1 text-xs ${MUTED_TEXT}`}>
                {source.tables
                  .map((table) => t(TABLE_LABELS[table]))
                  .join(" + ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModuleExport(source.key, "sql")}
                  disabled={loadingSource !== null}
                >
                  {loadingSource === source.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {t("Download SQL")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModuleExport(source.key, "excel")}
                  disabled={loadingSource !== null}
                >
                  {loadingSource === source.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  {t("Download Excel")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- history */}
      <section className={CARD}>
        <header className={`flex flex-wrap items-center gap-2 border-b px-5 py-3 ${HAIRLINE}`}>
          <Download className="h-4 w-4" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            {t("Backup & Restore History")}
          </h3>
          <span className={`ml-auto text-xs ${MUTED_TEXT}`}>
            {t("{count} entries", { count: history.length })}
          </span>
        </header>
        {history.length === 0 ? (
          <p className={`px-5 py-6 text-sm ${MUTED_TEXT}`}>
            {t(
              "No backup or restore has been recorded on this device yet.",
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={MUTED_TEXT}>
                <tr className={`border-b ${HAIRLINE}`}>
                  {[
                    t("Date & time"),
                    t("Action"),
                    t("Format"),
                    t("Mode"),
                    t("Rows"),
                    t("Tables"),
                    t("Performed by"),
                    t("Status"),
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-2 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className={`border-b last:border-0 ${HAIRLINE}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(entry.at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {entry.action === "backup" ? t("Backup") : t("Restore")}
                      {entry.note === "safety" && (
                        <span className={`ml-1 text-xs ${MUTED_TEXT}`}>
                          ({t("safety")})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.format}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${MUTED_TEXT}`}>
                      {entry.mode
                        ? entry.mode === "replace"
                          ? t("Full replace")
                          : t("Merge / Upsert")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.rows}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.tables}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${MUTED_TEXT}`}>
                      {performedByLabel(entry.performedBy, t)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {entry.status === "success"
                        ? t("Success")
                        : entry.status === "partial"
                          ? t("Partial")
                          : t("Failed")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {restoreOpen && (
        <RestoreDataModal
          open={restoreOpen}
          onClose={() => setRestoreOpen(false)}
          onFinished={loadCounts}
        />
      )}
    </div>
  );
}
