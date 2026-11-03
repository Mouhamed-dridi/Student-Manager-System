import { useEffect, useState } from "react";
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
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
import { errorMessage, type BackupTableName } from "@/lib/api";
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

export function BackupExportPage() {
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({});
  const [loadingSource, setLoadingSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fullBackupOpen, setFullBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const isAdmin = getRole() === "operator";

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
