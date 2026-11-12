import { useEffect, useRef, useState } from "react";
import { Loader2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranding } from "@/lib/branding";
import {
  errorMessage,
  resolveBilletContext,
  saveAbsenceBillet,
  type AbsenceBillet,
  type AttendanceRecord,
  type BilletSessionContext,
} from "@/lib/api";

// Printable student absence ticket ("billet d'absence").
//
// The dialog opens on an A5-proportioned white sheet and archives the ticket
// the moment it appears (the requirement is that every generated billet is
// stored, not only the ones the operator prints). The archive row is a
// snapshot, so reprinting from the Billets page shows the same ticket even
// after the attendance row changes.
//
// The sheet keeps light, high-contrast tokens in both themes — a dark-mode
// ticket would print as a black page — while the surrounding dialog follows the
// app theme.

interface AbsenceBilletModalProps {
  /** Attendance row the ticket is generated from (new ticket). */
  record?: AttendanceRecord | null;
  /** Existing ticket, when reprinting from the Billets archive. */
  billet?: AbsenceBillet | null;
  onClose: () => void;
  /** Called once the new ticket has been stored. */
  onSaved?: (billet: AbsenceBillet) => void;
}

/** Class / branch printed on the ticket, with the same fallbacks as the log. */
function classLabel(record: AttendanceRecord): string {
  return (
    record.className?.trim() ||
    record.training?.trim() ||
    record.program?.trim() ||
    "General"
  );
}

/**
 * Course / subject line. The attendance log does not carry a subject, so the
 * ticket uses the training (or program when the class label already includes
 * it) instead of printing the class twice. `resolveBilletContext()` upgrades
 * this to the scheduled session's subject when the match is unambiguous.
 */
function subjectLabel(record: AttendanceRecord): string {
  const className = record.className?.trim();
  const training = record.training?.trim();
  const program = record.program?.trim();
  if (training && training !== className) return training;
  if (program && program !== className) return program;
  return training || program || "";
}

function formatBilletDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** `BIL-20261108-9F3A1C`: date-stamped host code, unique per ticket. */
function makeBilletCode(date?: string | null): string {
  const stamp = (date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
    .replace(/-/g, "")
    .padEnd(8, "0");
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `BIL-${stamp}-${token}`;
}

/** Snapshots one attendance row into a new archive ticket. */
function archiveBillet(
  record: AttendanceRecord,
  code: string,
  context: BilletSessionContext | null,
) {
  return saveAbsenceBillet({
    attendanceId: record.id,
    // students.id, only when the row recorded an individual student target.
    studentId: record.targetType === "student" ? record.userId : null,
    studentName: record.fullName,
    className: classLabel(record),
    // The scheduled session wins; otherwise keep the class label as subject.
    // Never store the "—" placeholder: a blank column is honest, a dash is not.
    subject: context?.subject || subjectLabel(record) || null,
    teacherName: context?.teacherName ?? null,
    // `absence_date` is NOT NULL in the live table; a row without one falls
    // back to today rather than failing the archive and losing the ticket.
    absenceDate:
      record.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    timeSlot: record.time ?? record.absenceTime ?? null,
    code,
  });
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <p className="text-[9px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
        {label}
      </p>
      <p className="text-sm font-semibold break-words">{value}</p>
    </div>
  );
}

export default function AbsenceBilletModal({
  record,
  billet: archived,
  onClose,
  onSaved,
}: AbsenceBilletModalProps) {
  const branding = useBranding();
  const [billet, setBillet] = useState<AbsenceBillet | null>(archived ?? null);
  // A fresh ticket is archived on mount, so it starts in the saving state.
  const [saving, setSaving] = useState(Boolean(record));
  const [error, setError] = useState<string | null>(null);
  // Generated once per mount: retrying the archive must not mint a new code.
  const [code] = useState(
    () => archived?.code ?? makeBilletCode(record?.date),
  );
  // Guards the auto-archive against StrictMode's double effect in dev.
  const archivedRef = useRef(Boolean(archived));

  // Print setup: hide the app chrome and ask the browser for an A5 sheet (the
  // ticket layout is built for it). Both are removed when the dialog closes, so
  // receipt and planning printing are unaffected.
  useEffect(() => {
    document.body.classList.add("billet-printing");
    const pageStyle = document.createElement("style");
    pageStyle.textContent = "@page { size: A5 portrait; margin: 8mm; }";
    document.head.appendChild(pageStyle);
    return () => {
      document.body.classList.remove("billet-printing");
      pageStyle.remove();
    };
  }, []);

  // Retry after a failed archive (the code stays the one already printed).
  const retryArchive = async () => {
    if (!record) return;
    setSaving(true);
    setError(null);
    try {
      const context = await resolveBilletContext(
        record.className,
        record.date,
      ).catch(() => null);
      const saved = await archiveBillet(record, code, context);
      setBillet(saved);
      onSaved?.(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Archives a new ticket once, with the props of the first render. No cleanup
  // guard: the app runs in StrictMode, which re-runs this effect on the same
  // instance, so cancelling on cleanup would drop the only archive request.
  useEffect(() => {
    if (!record || archivedRef.current) return;
    archivedRef.current = true;
    (async () => {
      // Subject/teacher need one planning lookup; failing it must not cost the
      // ticket, so the context degrades to the class label and a blank teacher.
      const context = await resolveBilletContext(
        record.className,
        record.date,
      ).catch(() => null);
      return archiveBillet(record, code, context);
    })()
      .then((saved) => {
        setBillet(saved);
        setSaving(false);
        onSaved?.(saved);
      })
      .catch((err) => {
        setError(errorMessage(err));
        setSaving(false);
      });
  }, [record, code, onSaved]);

  const studentName = billet?.studentName ?? record?.fullName ?? "—";
  const className = billet?.className || (record ? classLabel(record) : "—");
  const subject =
    billet?.subject || (record ? subjectLabel(record) : "") || "—";
  const teacherName = billet?.teacherName || null;
  const absenceDate = billet?.absenceDate ?? record?.date ?? null;
  const timeSlot = billet?.timeSlot ?? record?.time ?? null;
  const issuedAt = billet
    ? new Date(billet.createdAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Absence ticket</DialogTitle>
          <DialogDescription>
            {billet
              ? "Archived billet — reprint it at any time."
              : saving
                ? "Generating the billet and saving it to the archive…"
                : "Printable billet d'absence."}
          </DialogDescription>
        </DialogHeader>

        <div
          id="billet-print-area"
          className="relative mx-auto w-full max-w-[430px] overflow-hidden rounded-md border border-neutral-200 bg-white p-6 text-neutral-900 shadow-sm"
        >
          {/* Watermark: faint on screen and on paper, never over the text. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="-rotate-[28deg] text-[68px] font-black whitespace-nowrap text-neutral-900/[0.055] uppercase tracking-[0.18em]">
              Absence
            </span>
          </div>

          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3 border-b-2 border-neutral-900 pb-3">
              <div className="min-w-0">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt=""
                    className="mb-1 h-8 w-auto max-w-[120px] object-contain"
                  />
                ) : null}
                <p className="truncate text-sm font-bold tracking-[0.1em] uppercase">
                  {branding.universityName || branding.systemName}
                </p>
                {branding.universityName ? (
                  <p className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                    {branding.systemName}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base leading-tight font-black uppercase">
                  Billet d&apos;absence
                </p>
                <p className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                  Absence ticket
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Field label="Student" value={studentName} wide />
              <Field label="Class / Branch" value={className} />
              <Field label="Course / Subject" value={subject} />
              <Field label="Teacher" value={teacherName || "—"} />
              <Field label="Date of absence" value={formatBilletDate(absenceDate)} />
              <Field label="Time" value={timeSlot?.trim() || "—"} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded border border-dashed border-neutral-300 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                  Verification code
                </p>
                <p className="font-mono text-sm font-bold tracking-[0.16em] break-all">
                  {code}
                </p>
              </div>
              <p className="shrink-0 text-right text-[9px] leading-tight tracking-[0.1em] text-neutral-400 uppercase">
                Valid
                <br />
                document
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-5">
              {["Student", "Teacher", "Administration"].map((label) => (
                <div key={label} className="text-center">
                  <div className="h-8 border-b border-neutral-400" />
                  <p className="mt-1 text-[9px] tracking-[0.12em] text-neutral-500 uppercase">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <p className="border-t border-neutral-200 pt-2 text-center text-[9px] tracking-[0.1em] text-neutral-400 uppercase">
              Issued {issuedAt} · Keep this ticket as justification
            </p>
          </div>
        </div>

        {saving ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving to the Billets archive…
          </p>
        ) : null}
        {billet ? (
          <p className="text-xs text-muted-foreground">
            Saved to the Billets archive.
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}

        <div className="billet-no-print flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            A5 · “Save as PDF” keeps a copy
          </span>
          <div className="flex gap-2">
            {error && record ? (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void retryArchive()}
              >
                <RotateCcw className="h-4 w-4" />
                Retry save
              </Button>
            ) : null}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
