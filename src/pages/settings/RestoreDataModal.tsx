import { useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
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
import { Switch } from "@/components/ui/switch";
import {
  errorMessage,
  replaceBackupTable,
  upsertBackupRows,
  type BackupTableName,
} from "@/lib/api";
import { appendBackupLog, type BackupLogMode } from "@/lib/backupLog";
import { useI18n } from "@/lib/i18n";
import { getRole } from "@/lib/session";
import {
  BACKUP_SOURCES,
  RESTORE_TABLES,
  TABLE_LABELS,
  parseFullBackupJson,
  parseSqlDump,
  parseSpreadsheetFile,
  type ParsedSpreadsheet,
  type RestoredTableGroup,
} from "./backupFormat";
import { runFullBackup } from "./fullBackup";

type Step = 1 | 2 | 3;

const ACCEPTED_EXTENSIONS = [".json", ".sql", ".csv", ".xlsx"];
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
 * Splits spreadsheet rows carrying a `table` column (written by multi-table
 * sources) into per-table groups. Returns null when there is no such column.
 */
function splitRowsByTableColumn(
  rows: Record<string, unknown>[],
): RestoredTableGroup[] | null {
  const withTable = rows.every(
    (row) =>
      typeof row.table === "string" &&
      Object.prototype.hasOwnProperty.call(TABLE_LABELS, row.table),
  );
  if (!withTable) return null;
  const groups = new Map<BackupTableName, Record<string, unknown>[]>();
  for (const row of rows) {
    const { table, ...rest } = row;
    const key = table as BackupTableName;
    const group = groups.get(key) ?? [];
    group.push(rest as Record<string, unknown>);
    groups.set(key, group);
  }
  return Array.from(groups, ([table, groupRows]) => ({ table, rows: groupRows }));
}

interface TableProgress {
  table: BackupTableName;
  rows: number;
  state: "pending" | "running" | "done" | "failed";
  restored: number;
  failed: number;
}

interface RestoreDataModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a restore so the page can refresh row counts and history. */
  onFinished?: () => void;
}

const MUTED_TEXT = "text-zinc-500 dark:text-zinc-400";
const HAIRLINE = "border-zinc-200 dark:border-zinc-800";

/**
 * Three-step restore wizard.
 *
 * 1. Inspect — parse the file (.json from Full System Backup, plus legacy
 *    .sql/.csv/.xlsx) and show the record count of every table before anything
 *    is written.
 * 2. Mode — Merge / Upsert (safe) or Full Replace. Choosing Replace downloads a
 *    safety backup of the current data first, so no overwrite is a dead end.
 * 3. Progress & audit — per-table progress, then the action is recorded in the
 *    page's Backup & Restore History.
 */
export default function RestoreDataModal({
  open,
  onClose,
  onFinished,
}: RestoreDataModalProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [groups, setGroups] = useState<RestoredTableGroup[] | null>(null);
  const [pending, setPending] = useState<{
    rows: Record<string, unknown>[];
    table: BackupTableName | null;
  } | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [fileSkipped, setFileSkipped] = useState<
    { table: string; message: string }[]
  >([]);
  const [mode, setMode] = useState<BackupLogMode>("merge");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [progress, setProgress] = useState<TableProgress[]>([]);
  const [safetyAt, setSafetyAt] = useState<string | null>(null);
  const [result, setResult] = useState<{
    restored: number;
    failed: number;
    tables: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);

  const reset = () => {
    setStep(1);
    setFileName(null);
    setGroups(null);
    setPending(null);
    setGeneratedAt(null);
    setFileSkipped([]);
    setMode("merge");
    setIncludeDeleted(true);
    setProgress([]);
    setSafetyAt(null);
    setResult(null);
    setError(null);
    startedRef.current = false;
  };

  const handleFile = async (file: File) => {
    reset();
    const extension = extensionOf(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError(t("Supported files: .json, .sql, .csv or .xlsx."));
      return;
    }
    if (file.size > FILE_MAX_BYTES) {
      setError(t("The file is larger than 25 MB."));
      return;
    }
    setFileName(file.name);
    setParsing(true);
    try {
      if (extension === ".json") {
        const parsed = parseFullBackupJson(await file.text());
        setGroups(parsed.groups);
        setGeneratedAt(parsed.generatedAt);
        setFileSkipped(parsed.skipped);
        if (parsed.includeDeleted === false) setIncludeDeleted(false);
        return;
      }
      if (extension === ".sql") {
        const parsed = parseSqlDump(await file.text());
        if (parsed.length === 0) {
          throw new Error(
            t("No INSERT statements for known tables were found in this file."),
          );
        }
        setGroups(parsed);
        return;
      }
      const parsed: ParsedSpreadsheet = await parseSpreadsheetFile(file);
      if (parsed.columns.length === 0 || parsed.rows.length === 0) {
        throw new Error(t("The sheet is empty or has no header row."));
      }
      const split = splitRowsByTableColumn(parsed.rows);
      if (split) {
        setGroups(split);
        return;
      }
      const source = BACKUP_SOURCES.find(
        (entry) => entry.key === sourceKeyFromFileName(file.name),
      );
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
    if (step !== 1 || running) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const targets: RestoredTableGroup[] = groups
    ? groups
    : pending && pending.table
      ? [{ table: pending.table, rows: pending.rows }]
      : [];
  // Trash rows leave the file before writing when the switch is off.
  const writeTargets: RestoredTableGroup[] = includeDeleted
    ? targets
    : targets.map((group) => ({
        table: group.table,
        rows: group.rows.filter((row) => row.is_deleted !== true),
      }));
  /** Rows in the file (step 1 preview). */
  const fileRows = targets.reduce((sum, group) => sum + group.rows.length, 0);
  /** Rows that will actually be written, after the trash switch. */
  const totalRows = writeTargets.reduce(
    (sum, group) => sum + group.rows.length,
    0,
  );
  const hasPreview = targets.length > 0;

  /** Downloads a JSON backup of the live data before an overwrite. */
  const downloadSafetyBackup = async (): Promise<string | null> => {
    try {
      const backup = await runFullBackup("json", true);
      appendBackupLog({
        action: "backup",
        format: "JSON",
        rows: backup.rows,
        tables: backup.tables,
        performedBy: getRole() ?? "operator",
        note: "safety",
        status: backup.skipped.length > 0 ? "partial" : "success",
      });
      return backup.at;
    } catch {
      return null;
    }
  };

  const handleStart = async () => {
    if (startedRef.current || writeTargets.length === 0) return;
    startedRef.current = true;
    setError(null);
    setRunning(true);
    setStep(3);
    setProgress(
      writeTargets.map((group) => ({
        table: group.table,
        rows: group.rows.length,
        state: "pending" as const,
        restored: 0,
        failed: 0,
      })),
    );

    let safety: string | null = null;
    if (mode === "replace") {
      safety = await downloadSafetyBackup();
      setSafetyAt(safety);
      if (!safety) {
        setError(
          t(
            "The safety backup could not be written, so nothing was overwritten.",
          ),
        );
        setRunning(false);
        startedRef.current = false;
        return;
      }
    }

    let restored = 0;
    let failed = 0;
    try {
      for (const group of writeTargets) {
        setProgress((prev) =>
          prev.map((entry) =>
            entry.table === group.table ? { ...entry, state: "running" } : entry,
          ),
        );
        const write = mode === "replace" ? replaceBackupTable : upsertBackupRows;
        const outcome = await write(group.table, group.rows, (doneSoFar) => {
          setProgress((prev) =>
            prev.map((entry) =>
              entry.table === group.table
                ? {
                    ...entry,
                    restored: Math.min(doneSoFar, group.rows.length),
                  }
                : entry,
            ),
          );
        });
        restored += outcome.restored;
        failed += outcome.failed;
        setProgress((prev) =>
          prev.map((entry) =>
            entry.table === group.table
              ? {
                  ...entry,
                  state: outcome.failed > 0 ? "failed" : "done",
                  restored: outcome.restored,
                  failed: outcome.failed,
                }
              : entry,
          ),
        );
      }
      setResult({ restored, failed, tables: writeTargets.length });
      appendBackupLog({
        action: "restore",
        format: fileName?.toLowerCase().endsWith(".json")
          ? "JSON"
          : (fileName ?? "").toLowerCase().endsWith(".sql")
            ? "SQL"
            : "Excel",
        mode,
        rows: restored,
        failures: failed,
        tables: writeTargets.length,
        performedBy: getRole() ?? "operator",
        status:
          failed === 0 && restored > 0
            ? "success"
            : restored === 0
              ? "failed"
              : "partial",
      });
      onFinished?.();
    } catch (err) {
      setError(errorMessage(err));
      appendBackupLog({
        action: "restore",
        format: "JSON",
        mode,
        rows: restored,
        failures: failed,
        tables: writeTargets.length,
        performedBy: getRole() ?? "operator",
        status: "failed",
      });
      onFinished?.();
    } finally {
      setRunning(false);
    }
  };

  const recordedRows = progress.reduce(
    (sum, entry) => sum + entry.restored + entry.failed,
    0,
  );
  const percentOf = (done: number) =>
    totalRows === 0 ? 0 : Math.round((done / totalRows) * 100);

  const steps = [
    { number: 1 as Step, label: t("Inspect file") },
    { number: 2 as Step, label: t("Restore mode") },
    { number: 3 as Step, label: t("Progress & audit") },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen && !running) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Restore / Import Data")}</DialogTitle>
          <DialogDescription>
            {t(
              "Review the backup, choose how it is written, then follow the restore progress.",
            )}
          </DialogDescription>
        </DialogHeader>

        {/* --------------------------------------------------------- stepper */}
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {steps.map((entry) => {
            const active = step === entry.number;
            const done = step > entry.number;
            return (
              <li
                key={entry.number}
                className={
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 " +
                  (active
                    ? "border-zinc-900 text-zinc-900 dark:border-zinc-200 dark:text-zinc-100"
                    : done
                      ? `${HAIRLINE} ${MUTED_TEXT}`
                      : `border-dashed ${HAIRLINE} ${MUTED_TEXT}`)
                }
              >
                <span className="font-mono text-[10px]">{entry.number}</span>
                <span className="font-medium">{entry.label}</span>
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <div className="space-y-3">
            {parsing ? (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-6 text-sm ${HAIRLINE}`}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("Reading {name}…", { name: fileName ?? "" })}
              </div>
            ) : !hasPreview ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) =>
                  event.key === "Enter" && inputRef.current?.click()
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={
                  "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-3 py-10 text-center transition-colors " +
                  (dragging
                    ? "border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-800"
                    : HAIRLINE)
                }
              >
                <Upload className="h-8 w-8 text-zinc-400" />
                <p className="text-sm font-medium">
                  {t("Drag & drop the backup file here")}
                </p>
                <p className={`text-xs ${MUTED_TEXT}`}>
                  {t("or click to browse · .json backup (SQL and spreadsheets are still accepted)")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${HAIRLINE}`}
                >
                  {fileName?.toLowerCase().endsWith(".json") ? (
                    <FileJson className="h-4 w-4 shrink-0" />
                  ) : (fileName ?? "").toLowerCase().endsWith(".sql") ? (
                    <FileText className="h-4 w-4 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate font-medium">{fileName}</span>
                  <span className={`ml-auto text-xs ${MUTED_TEXT}`}>
                    {t("{count} rows", { count: fileRows })}
                  </span>
                </div>

                {generatedAt && (
                  <p className={`text-xs ${MUTED_TEXT}`}>
                    {t("Exported on {date}.", {
                      date: new Date(generatedAt).toLocaleString(),
                    })}
                  </p>
                )}

                <div className={`rounded-md border px-3 py-2 text-sm ${HAIRLINE}`}>
                  <p className="font-medium">{t("Records detected")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {targets.map((group) => (
                      <li
                        key={group.table}
                        className="flex justify-between gap-4"
                      >
                        <span>{t(TABLE_LABELS[group.table])}</span>
                        <span className={MUTED_TEXT}>
                          {t("{count} rows", { count: group.rows.length })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {pending && (
                  <div className={`space-y-2 rounded-md border px-3 py-2 ${HAIRLINE}`}>
                    <p className="text-xs font-medium">{t("Target table")}</p>
                    <Select
                      value={pending.table ?? ""}
                      onValueChange={(value) =>
                        setPending({
                          ...pending,
                          table: (value || null) as BackupTableName | null,
                        })
                      }
                      items={RESTORE_TABLES.map((entry) => ({
                        value: entry.name,
                        label: t(entry.label),
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select table…")} />
                      </SelectTrigger>
                      <SelectContent>
                        {RESTORE_TABLES.map((entry) => (
                          <SelectItem key={entry.name} value={entry.name}>
                            {t(entry.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {fileSkipped.length > 0 && (
                  <p className={`text-xs ${MUTED_TEXT}`}>
                    {t("The original backup skipped:")}{" "}
                    {fileSkipped.map((entry) => entry.table).join(", ")}.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p
                role="alert"
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${HAIRLINE}`}
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
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleFile(file);
              }}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "merge" as BackupLogMode,
                    title: t("Merge / Upsert (Safe)"),
                    hint: t(
                      "Updates rows that already exist and adds the missing ones. Nothing is deleted.",
                    ),
                  },
                  {
                    value: "replace" as BackupLogMode,
                    title: t("Full Replace (Overwrite)"),
                    hint: t(
                      "Deletes the current rows of every table in the file, then writes the backup.",
                    ),
                  },
                ] as const
              ).map((option) => {
                const selected = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setMode(option.value)}
                    className={
                      "rounded-lg border px-3 py-2.5 text-left transition-colors " +
                      (selected
                        ? "border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-800"
                        : `${HAIRLINE} hover:bg-zinc-50 dark:hover:bg-zinc-900`)
                    }
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {option.value === "merge" ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      {option.title}
                    </span>
                    <span className={`mt-1 block text-xs ${MUTED_TEXT}`}>
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className={`flex items-start justify-between gap-4 rounded-md border px-3 py-2.5 ${HAIRLINE}`}
            >
              <div>
                <p className="text-sm font-medium">
                  {t("Include deleted (Trash) records")}
                </p>
                <p className={`mt-0.5 text-xs ${MUTED_TEXT}`}>
                  {t(
                    "When off, trashed rows in the file are skipped instead of being restored.",
                  )}
                </p>
              </div>
              <Switch
                checked={includeDeleted}
                onCheckedChange={setIncludeDeleted}
                aria-label={t("Include deleted (Trash) records")}
              />
            </div>

            {mode === "replace" && (
              <p
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${HAIRLINE}`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t(
                  "A safety backup of the current data downloads automatically before anything is deleted. This cannot be undone.",
                )}
              </p>
            )}

            <p className={`text-xs ${MUTED_TEXT}`}>
              {t("{tables} tables · {rows} rows will be written.", {
                tables: writeTargets.length,
                rows: totalRows,
              })}
            </p>

            {error && (
              <p
                role="alert"
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${HAIRLINE}`}
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : result && result.failed === 0 ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {running
                    ? t("Restoring…")
                    : result
                      ? t("Restore finished")
                      : t("Restore stopped")}
                </span>
                <span className="font-semibold">
                  {percentOf(recordedRows)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all duration-300 dark:bg-zinc-100"
                  style={{ width: `${percentOf(recordedRows)}%` }}
                />
              </div>
            </div>

            {safetyAt && (
              <p className={`flex items-start gap-2 text-xs ${MUTED_TEXT}`}>
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("Safety backup downloaded at {date}.", {
                  date: new Date(safetyAt).toLocaleString(),
                })}
              </p>
            )}

            <div className={`max-h-64 space-y-1 overflow-y-auto rounded-md border px-3 py-2 ${HAIRLINE}`}>
              {progress.map((entry) => (
                <div
                  key={entry.table}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {entry.state === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : entry.state === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : entry.state === "failed" ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <ClockDot />
                    )}
                    {t(TABLE_LABELS[entry.table])}
                  </span>
                  <span className={`text-xs ${MUTED_TEXT}`}>
                    {entry.restored + entry.failed}/{entry.rows}
                    {entry.failed > 0
                      ? ` · ${t("{count} skipped", { count: entry.failed })}`
                      : ""}
                  </span>
                </div>
              ))}
            </div>

            {result && (
              <p className="text-sm">
                {t("{restored} rows restored, {failed} skipped.", {
                  restored: result.restored,
                  failed: result.failed,
                })}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${HAIRLINE}`}
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("Cancel")}
              </Button>
              {hasPreview && (
                <Button variant="outline" onClick={reset}>
                  {t("Choose another file")}
                </Button>
              )}
              <Button disabled={!hasPreview || parsing} onClick={() => setStep(2)}>
                {t("Continue")}
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("Back")}
              </Button>
              <Button onClick={handleStart}>
                {mode === "replace"
                  ? t("Back up and restore")
                  : t("Start restore")}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button onClick={onClose} disabled={running}>
              {running ? t("Restoring…") : t("Close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small hollow dot for tables that have not started yet. */
function ClockDot() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-300 dark:border-zinc-700"
    />
  );
}
