import { useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage, upsertBackupRows, type BackupTableName } from "@/lib/api";
import {
  BACKUP_SOURCES,
  RESTORE_TABLES,
  parseSqlDump,
  parseSpreadsheetFile,
  type ParsedSpreadsheet,
  type RestoredTableGroup,
} from "./backupFormat";

type Phase = "pick" | "running" | "done";

interface RestoreDataModalProps {
  open: boolean;
  onClose: () => void;
}

const ACCEPTED_EXTENSIONS = [".sql", ".csv", ".xlsx"];
const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");
const FILE_MAX_BYTES = 25 * 1024 * 1024;

const extensionOf = (name: string) =>
  name.slice(name.lastIndexOf(".")).toLowerCase();

/** "user-management-backup-2026-01-01.csv" → "user-management". */
const sourceKeyFromFileName = (name: string): string | null => {
  const lower = name.toLowerCase();
  const match = BACKUP_SOURCES.filter((source) =>
    lower.startsWith(`${source.key}-`),
  ).sort((a, b) => b.key.length - a.key.length)[0];
  return match?.key ?? null;
};

/**
 * Splits spreadsheet rows carrying a `table` column (written by the
 * User Management source, which spans the students and teachers tables)
 * into per-table groups. Returns null when there is no such column.
 */
function splitRowsByTableColumn(
  rows: Record<string, unknown>[],
): RestoredTableGroup[] | null {
  const withTable = rows.every(
    (row) =>
      typeof row.table === "string" &&
      RESTORE_TABLES.some((entry) => entry.name === row.table),
  );
  if (!withTable) return null;
  const groups = new Map<BackupTableName, Record<string, unknown>[]>();
  for (const row of rows) {
    const { table, ...rest } = row;
    const group = groups.get(table as BackupTableName) ?? [];
    group.push(rest as Record<string, unknown>);
    groups.set(table as BackupTableName, group);
  }
  return Array.from(groups, ([table, groupRows]) => ({ table, rows: groupRows }));
}

/**
 * Restore workflow: a drag-and-drop upload accepts .sql files (as generated
 * by the exports here) or .csv/.xlsx sheets, previews what will be written,
 * then — only after the operator confirms the overwrite warning — upserts the
 * rows back into the matching tables.
 */
export default function RestoreDataModal({ open, onClose }: RestoreDataModalProps) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [groups, setGroups] = useState<RestoredTableGroup[] | null>(null);
  // Spreadsheets with no usable `table` column and no recognizable filename
  // still need the operator to pick the single target table.
  const [pending, setPending] = useState<{
    rows: Record<string, unknown>[];
    table: BackupTableName | null;
  } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [result, setResult] = useState<{ restored: number; failed: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setPhase("pick");
    setFileName(null);
    setGroups(null);
    setPending(null);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setError(null);
  };

  const handleFile = async (file: File) => {
    reset();
    setError(null);
    const extension = extensionOf(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("Supported files: .sql (dump from this app), .csv or .xlsx.");
      return;
    }
    if (file.size > FILE_MAX_BYTES) {
      setError("The file is larger than 25 MB.");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    try {
      if (extension === ".sql") {
        const parsed = parseSqlDump(await file.text());
        if (parsed.length === 0) {
          throw new Error(
            "No INSERT statements for known tables were found in this file.",
          );
        }
        setGroups(parsed);
        return;
      }
      const parsed: ParsedSpreadsheet = await parseSpreadsheetFile(file);
      if (parsed.columns.length === 0 || parsed.rows.length === 0) {
        throw new Error("The sheet is empty or has no header row.");
      }
      // Multi-table spreadsheets declare their target in a `table` column.
      const split = splitRowsByTableColumn(parsed.rows);
      if (split) {
        setGroups(split);
        return;
      }
      // Otherwise: a recognized filename pins the target automatically.
      const sourceKey = sourceKeyFromFileName(file.name);
      const source = BACKUP_SOURCES.find((entry) => entry.key === sourceKey);
      if (source && source.tables.length === 1) {
        setGroups([{ table: source.tables[0], rows: parsed.rows }]);
        return;
      }
      setPending({ rows: parsed.rows, table: null });
    } catch (err) {
      setError(errorMessage(err));
      setFileName(null);
      setGroups(null);
      setPending(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (phase !== "pick") return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleRestore = async () => {
    const targets: RestoredTableGroup[] = groups
      ? groups
      : pending && pending.table
        ? [{ table: pending.table, rows: pending.rows }]
        : [];
    if (targets.length === 0) return;
    const total = targets.reduce((sum, group) => sum + group.rows.length, 0);
    setPhase("running");
    setProgress({ done: 0, total });
    let restored = 0;
    let failed = 0;
    try {
      for (const group of targets) {
        const { restored: ok, failed: bad } = await upsertBackupRows(
          group.table,
          group.rows,
          (doneSoFar) => {
            // doneSoFar scopes to this group; previous groups already ran.
            const before = restored + failed;
            setProgress({ done: before + doneSoFar, total });
          },
        );
        restored += ok;
        failed += bad;
      }
      setResult({ restored, failed });
      setPhase("done");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("pick");
    }
  };

  const hasPreview = groups !== null || pending !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen && phase !== "running") onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore / Import Data</DialogTitle>
          <DialogDescription>
            {phase === "done"
              ? "The restore has finished."
              : "Drop a backup file (.sql, .csv or .xlsx) or click to browse."}
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" && (
          <div className="space-y-4">
            {parsing ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-6 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading {fileName}…
              </div>
            ) : !hasPreview ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={
                  "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-3 py-10 text-center transition-colors " +
                  (dragging ? "border-primary bg-muted" : "")
                }
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drag &amp; drop the backup file here
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse · .sql, .csv, .xlsx (max 25 MB)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  {groups ? (
                    <FileText className="h-4 w-4 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate font-medium">{fileName}</span>
                </div>

                {groups ? (
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    <p className="font-medium">Rows detected</p>
                    <ul className="mt-1 space-y-0.5">
                      {groups.map((group) => (
                        <li
                          key={group.table}
                          className="flex justify-between gap-4"
                        >
                          <span>{group.table}</span>
                          <span className="text-muted-foreground">
                            {group.rows.length} rows
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : pending ? (
                  <div className="space-y-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span>Rows detected</span>
                      <span className="text-muted-foreground">
                        {pending.rows.length} rows
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Target table
                      </p>
                      <Select
                        value={pending.table ?? ""}
                        onValueChange={(value) =>
                          setPending({
                            ...pending,
                            table: (value || null) as BackupTableName | null,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select table…" />
                        </SelectTrigger>
                        <SelectContent>
                          {RESTORE_TABLES.map((entry) => (
                            <SelectItem key={entry.name} value={entry.name}>
                              {entry.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Restoring will <strong>overwrite existing rows</strong> that
                    share the same id (or key) in the target table(s). This
                    cannot be undone — make sure you have a current backup
                    first.
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleFile(file);
              }}
            />
          </div>
        )}

        {phase === "running" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring rows…
              </span>
              <span className="font-semibold">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    progress.total === 0
                      ? 0
                      : Math.round((progress.done / progress.total) * 100)
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-10 w-10" />
            <p className="text-base font-semibold">Restore finished</p>
            <p className="text-sm text-muted-foreground">
              {result.restored} rows restored
              {result.failed > 0
                ? `, ${result.failed} rows could not be written and were skipped`
                : "."}
            </p>
          </div>
        )}

        <DialogFooter>
          {phase === "pick" && !hasPreview && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          {phase === "pick" && hasPreview && (
            <Button
              variant="outline"
              onClick={() => {
                reset();
                setError(null);
              }}
            >
              Choose another file
            </Button>
          )}
          {phase === "pick" && (groups !== null || pending?.table) && (
            <Button onClick={handleRestore}>Restore Data</Button>
          )}
          {phase !== "pick" && (
            <Button
              variant={phase === "done" ? "default" : "outline"}
              onClick={onClose}
              disabled={phase === "running"}
            >
              {phase === "running" ? "Restoring…" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
