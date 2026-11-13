import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { CheckCircle2, FileSpreadsheet, FileText, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage, markCenterBackupDone } from "@/lib/api";
import {
  BACKUP_SOURCES,
  FULL_BACKUP_FILE_NAME,
  backupFileName,
  fetchSourceSections,
  workbookBytesForSections,
  generateSqlDocument,
} from "./backupFormat";

type Phase = "pick" | "running" | "done" | "error";
type Format = "sql" | "excel";

interface FullBackupModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full backup workflow: format selection first (SQL scripts or Excel files),
 * then a progress modal that fetches every source sequentially and packages
 * one file per table into a `.zip` archive built client-side with JSZip.
 * The dialog cannot be dismissed mid-run.
 */
export default function FullBackupModal({ open, onClose }: FullBackupModalProps) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("");
  const [result, setResult] = useState<{
    sources: number;
    rows: number;
    fileName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One run per mount: the page renders this modal conditionally, so closing
  // unmounts it and the next open starts from the format-picker state again.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open || phase !== "running" || startedRef.current) return;
    startedRef.current = true;

    const run = async (format: Format) => {
      try {
        const zip = new JSZip();
        let rows = 0;
        for (let index = 0; index < BACKUP_SOURCES.length; index++) {
          const source = BACKUP_SOURCES[index];
          setCurrentLabel(source.label);
          const sections = await fetchSourceSections(source.key);
          rows += sections.reduce((sum, section) => sum + section.rows.length, 0);
          if (format === "sql") {
            const sql = generateSqlDocument(source.label, sections);
            zip.file(backupFileName(source.key, "sql"), sql);
          } else {
            const bytes = workbookBytesForSections(sections);
            zip.file(backupFileName(source.key, "xlsx"), bytes);
          }
          setProgress(
            Math.round(((index + 1) / BACKUP_SOURCES.length) * 100),
          );
        }
        setResult({
          sources: BACKUP_SOURCES.length,
          rows,
          fileName: FULL_BACKUP_FILE_NAME,
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = FULL_BACKUP_FILE_NAME;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        // Stamp the backup on center_settings before reporting success.
        await markCenterBackupDone();
        setPhase("done");
      } catch (err) {
        setError(errorMessage(err));
        setPhase("error");
      }
    };

    // Which format was picked is read from the phase payload stored on start.
    void run(startedFormatRef.current);
  }, [open, phase]);

  const startedFormatRef = useRef<Format>("sql");

  const startBackup = (format: Format) => {
    startedFormatRef.current = format;
    setProgress(0);
    setResult(null);
    setError(null);
    setCurrentLabel("");
    setPhase("running");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen && phase !== "running") onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Full Backup</DialogTitle>
          <DialogDescription>
            {phase === "pick" && (
              <>
                Choose the export format. Every table is fetched and packed as
                one file per table inside a single <code>.zip</code> archive.
              </>
            )}
            {phase === "running" &&
              "Fetching every table one at a time. Please keep this page open."}
            {phase === "done" &&
              "Every table was exported and packed into the archive."}
            {phase === "error" && "The backup could not be completed."}
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => startBackup("sql")}
                className="flex flex-col items-start gap-1 rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  SQL Scripts
                </span>
                <span className="text-xs text-muted-foreground">
                  One <code>.sql</code> file per table with INSERT statements.
                </span>
              </button>
              <button
                type="button"
                onClick={() => startBackup("excel")}
                className="flex flex-col items-start gap-1 rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel / CSV Files
                </span>
                <span className="text-xs text-muted-foreground">
                  One <code>.xlsx</code> workbook per table.
                </span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tables: {BACKUP_SOURCES.map((source) => source.label).join(" · ")}
            </p>
          </div>
        )}

        {phase === "running" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {currentLabel ? `Exporting ${currentLabel}…` : "Starting…"}
              </span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-10 w-10" />
            <p className="text-base font-semibold">
              Backup Completed Successfully!
            </p>
            <p className="text-sm text-muted-foreground">
              {result.rows} rows across {result.sources} tables are in{" "}
              <code>{result.fileName}</code>.
            </p>
          </div>
        )}

        {phase === "error" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          {phase === "pick" && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          {(phase === "done" || phase === "error") && (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
