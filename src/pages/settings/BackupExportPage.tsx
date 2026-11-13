import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CENTER_EXPORT_TABLES,
  errorMessage,
  getSettings,
  markCenterBackupDone,
  type BackupTableName,
} from "@/lib/api";
import { getRole } from "@/lib/session";
import FullBackupModal from "./FullBackupModal";
import RestoreDataModal from "./RestoreDataModal";
import {
  BACKUP_SOURCES,
  backupFileName,
  fetchSourceSections,
  generateSqlDocument,
  sourceRowCount,
} from "./backupFormat";
import { runCenterExport, type CenterExportFormat } from "./centerExport";

function downloadText(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface BackupExportPageProps {
  /** `last_backup_at` already loaded by the Settings page, when nested there. */
  lastBackupAt?: string;
  /** Lets the Settings page show the new stamp without a refetch. */
  onBackupDone?: (at: string) => void;
}

export function BackupExportPage({
  lastBackupAt,
  onBackupDone,
}: BackupExportPageProps = {}) {
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({});
  const [loadingSource, setLoadingSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fullBackupOpen, setFullBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [exporting, setExporting] = useState<CenterExportFormat | null>(null);
  const [fetchedBackupAt, setFetchedBackupAt] = useState("");
  const [exportedBackupAt, setExportedBackupAt] = useState("");

  const isAdmin = getRole() === "operator";

  // Nested in Settings the stamp arrives as a prop; standalone (sidebar
  // section) it is read from the settings row once, and after an export the
  // local stamp wins so the label updates without a refetch.
  const lastBackup =
    lastBackupAt !== undefined
      ? lastBackupAt
      : exportedBackupAt || fetchedBackupAt;

  useEffect(() => {
    if (!isAdmin || lastBackupAt !== undefined) return;
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled) setFetchedBackupAt(settings.lastBackupAt ?? "");
      })
      .catch(() => {
        // Optional schema / offline: the label stays "no backup recorded".
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, lastBackupAt]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void Promise.all(
      BACKUP_SOURCES.map(async (source) => {
        try {
          const count = await sourceRowCount(source.key);
          if (!cancelled) setCounts((prev) => ({ ...prev, [source.key]: count }));
        } catch {
          // Counts are decorative; the per-source export reports real errors.
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <ShieldAlert className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Admin access required</p>
            <p className="text-sm text-muted-foreground">
              Backup &amp; Export is restricted to operator accounts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCenterExport = async (format: CenterExportFormat) => {
    setExporting(format);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await runCenterExport(format);
      setExportedBackupAt(result.at);
      onBackupDone?.(result.at);
      const skipped = result.skipped.length
        ? ` Skipped: ${result.skipped.map((entry) => entry.table).join(", ")}.`
        : "";
      setSuccessMessage(
        `Full database exported as ${format.toUpperCase()} (${result.rows} rows).${skipped}`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  /** Records the download on `center_settings.last_backup_at`. */
  const stampBackup = async () => {
    const at = new Date().toISOString();
    setExportedBackupAt(at);
    onBackupDone?.(at);
    await markCenterBackupDone(at);
  };

  const handleExportSql = async (sourceKey: string) => {
    const source = BACKUP_SOURCES.find((entry) => entry.key === sourceKey);
    if (!source) return;
    setLoadingSource(sourceKey);
    setError(null);
    setSuccessMessage(null);
    try {
      const sections = await fetchSourceSections(sourceKey);
      const rows = sections.reduce((sum, section) => sum + section.rows.length, 0);
      downloadText(
        backupFileName(sourceKey, "sql"),
        generateSqlDocument(source.label, sections),
      );
      await stampBackup();
      setSuccessMessage(`${source.label} exported as SQL (${rows} rows).`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingSource(null);
    }
  };

  const handleExportExcel = async (sourceKey: string) => {
    const source = BACKUP_SOURCES.find((entry) => entry.key === sourceKey);
    if (!source) return;
    setLoadingSource(sourceKey);
    setError(null);
    setSuccessMessage(null);
    try {
      const sections = await fetchSourceSections(sourceKey);
      const rows = sections.reduce((sum, section) => sum + section.rows.length, 0);
      const workbookBytes = await import("./backupFormat");
      // Build the workbook through the shared helper (rounded to XLSX bytes).
      const { workbookBytesForSections } = workbookBytes;
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
      await stampBackup();
      setSuccessMessage(`${source.label} exported as Excel (${rows} rows).`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingSource(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Backup &amp; Export</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download database tables as SQL scripts or Excel files. Every row is
            included, including trash-deleted records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setFullBackupOpen(true)}>
            <DatabaseBackup className="h-4 w-4" />
            Full Backup
          </Button>
          <Button variant="outline" onClick={() => setRestoreOpen(true)}>
            <Upload className="h-4 w-4" />
            Restore / Import Data
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Full database</CardTitle>
          <CardDescription>
            Download the center's core tables (
            {CENTER_EXPORT_TABLES.join(", ")}) as one JSON document or one
            CSV file. The export also stamps <code>last_backup_at</code> on the
            settings row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleCenterExport("json")}
              disabled={exporting !== null}
            >
              {exporting === "json" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              Export Full Database (JSON)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCenterExport("csv")}
              disabled={exporting !== null}
            >
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {lastBackup
              ? `Last backup: ${new Date(lastBackup).toLocaleString()}`
              : "No backup recorded yet."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {BACKUP_SOURCES.map((source) => (
          <Card key={source.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{source.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {counts[source.key] === undefined
                    ? "— rows"
                    : `${counts[source.key]} rows`}
                </span>
              </CardTitle>
              <CardDescription>
                Export all data from the{" "}
                {source.tables
                  .map((table: BackupTableName) => <code key={table}>{table}</code>)
                  .reduce<React.ReactNode[]>((acc, node, index) => {
                    return index === 0 ? [node] : [...acc, " + ", node];
                  }, [])}{" "}
                table{source.tables.length > 1 ? "s" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportSql(source.key)}
                disabled={loadingSource !== null}
              >
                {loadingSource === source.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Download SQL
              </Button>
              {source.dualExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportExcel(source.key)}
                  disabled={loadingSource !== null}
                >
                  {loadingSource === source.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Excel
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {fullBackupOpen && (
        <FullBackupModal
          open={fullBackupOpen}
          onClose={() => setFullBackupOpen(false)}
        />
      )}
      {restoreOpen && (
        <RestoreDataModal
          open={restoreOpen}
          onClose={() => setRestoreOpen(false)}
        />
      )}
    </div>
  );
}
