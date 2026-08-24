import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DataError, DataLoading } from "@/components/DataState";
import {
  deletePlanning,
  errorMessage,
  insertPlanning,
  listPlanning,
  updatePlanning,
} from "@/lib/api";
import { loadScheduledCourses } from "@/lib/trainings";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { PlanningRecord } from "./planning";
import { loadCurrentTeacher } from "./currentTeacher";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

interface EntryFormValues {
  course?: string;
  content: string;
}

interface EntryFormProps {
  initial?: PlanningRecord;
  courses: string[];
  submitLabel: string;
  showCancel: boolean;
  onSubmit: (values: EntryFormValues) => void;
  onCancel: () => void;
}

function EntryForm({
  initial,
  courses,
  submitLabel,
  showCancel,
  onSubmit,
  onCancel,
}: EntryFormProps) {
  const [course, setCourse] = useState(initial?.course ?? "");
  const [content, setContent] = useState(initial?.content ?? "");

  const valid = content.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Course</Label>
        <Select value={course} onValueChange={(value) => setCourse(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                courses.length > 0 ? "Select course" : "No courses available"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="log-content">Topic / Content Covered</Label>
        <Textarea
          id="log-content"
          placeholder="What was studied during this session…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end gap-2">
        {showCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!valid}
          onClick={() =>
            onSubmit({ course: course || undefined, content: content.trim() })
          }
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

interface DayDialogProps {
  date: string;
  entries: PlanningRecord[];
  courses: string[];
  onSave: (values: EntryFormValues, editingId: string | null) => void;
  onDeleteRequest: (entry: PlanningRecord) => void;
  onClose: () => void;
}

function DayDialog({
  date,
  entries,
  courses,
  onSave,
  onDeleteRequest,
  onClose,
}: DayDialogProps) {
  const [formOpen, setFormOpen] = useState(entries.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId
    ? (entries.find((e) => e.id === editingId) ?? null)
    : null;

  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planning entry</DialogTitle>
          <DialogDescription>{longDate}</DialogDescription>
        </DialogHeader>

        {formOpen || entries.length === 0 ? (
          <EntryForm
            key={editingId ?? "new"}
            initial={editing ?? undefined}
            courses={courses}
            submitLabel={editingId ? "Save Changes" : "Add Entry"}
            showCancel={!!editingId}
            onSubmit={(values) => onSave(values, editingId)}
            onCancel={() => {
              setEditingId(null);
              setFormOpen(false);
            }}
          />
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {e.course || "—"}
                    </p>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(e.id);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete entry ${e.course || ""}`.trim()}
                        onClick={() => onDeleteRequest(e)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {e.content}
                  </p>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PlanningPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [entries, setEntries] = useState<PlanningRecord[] | null>(null);
  const [courses, setCourses] = useState<string[]>([]);
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanningRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled || !record) {
          if (!cancelled) setTeacher(record ?? null);
          return;
        }
        setTeacher(record);
        try {
          const [all, scheduled] = await Promise.all([
            listPlanning(),
            loadScheduledCourses(record.program, record.training),
          ]);
          if (cancelled) return;
          setEntries(all);
          setCourses([...new Set(scheduled.map((c) => c.name))]);
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (teacher === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Planning</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your teacher record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  if (teacher === undefined || entries === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Planning</h2>
        <DataLoading label="Loading planning…" />
      </div>
    );
  }

  const refresh = async () => {
    try {
      setError(null);
      const [all, scheduled] = await Promise.all([
        listPlanning(),
        loadScheduledCourses(teacher.program, teacher.training),
      ]);
      setEntries(all);
      setCourses([...new Set(scheduled.map((c) => c.name))]);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const myEntries = entries.filter((p) => p.teacherId === teacher.id);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    return d;
  });
  const weekKeys = weekDays.map(dateKeyOf);
  const weekKeySet = new Set(weekKeys);

  const weekEntries = myEntries
    .filter((p) => weekKeySet.has(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map<string, PlanningRecord[]>();
  for (const p of weekEntries) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }

  const stepWeek = (dir: 1 | -1) =>
    setCursor((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + dir * 7);
      return next;
    });

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const shortFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const fullFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const rangeLabel = sameMonth
    ? `${shortFmt.format(weekStart)} – ${shortFmt.format(weekEnd)}, ${weekEnd.getFullYear()}`
    : sameYear
      ? `${shortFmt.format(weekStart)} – ${fullFmt.format(weekEnd)}`
      : `${fullFmt.format(weekStart)} – ${fullFmt.format(weekEnd)}`;

  const exportRows = weekEntries.map((p) => [p.date, p.course ?? "", p.content]);
  const fileStem = `planning-${weekKeys[0]}`;

  const exportExcel = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Date", "Course", "Topic covered"],
      ...exportRows,
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planning");
    XLSX.writeFile(workbook, `${fileStem}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Planning — ${rangeLabel}`, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Date", "Course", "Topic covered"]],
      body: exportRows,
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 50 } },
    });
    doc.save(`${fileStem}.pdf`);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Planning</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Click any day to log what was studied with your class.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => stepWeek(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">
            {rangeLabel}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => stepWeek(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={weekEntries.length === 0}
            onClick={exportExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export as Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={weekEntries.length === 0}
            onClick={exportPdf}
          >
            <FileText className="h-4 w-4" />
            Export as PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-7 gap-2">
        {weekDays.map((d, i) => {
          const key = weekKeys[i];
          const dayEntries = byDate.get(key) ?? [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenDate(key)}
              className="flex min-h-56 flex-col items-stretch gap-1.5 rounded-md border p-2 text-left transition-colors hover:bg-accent/50"
            >
              <span className="pb-1 text-center">
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                  {WEEKDAYS[i]}
                </span>
                <span className="text-base font-semibold">{d.getDate()}</span>
              </span>
              {dayEntries.map((e) => (
                <span key={e.id} className="block rounded bg-accent px-1.5 py-1">
                  <span className="block truncate text-xs font-medium text-accent-foreground">
                    {e.course || "Logged session"}
                  </span>
                  <span className="mt-0.5 line-clamp-3 block text-xs text-muted-foreground">
                    {e.content}
                  </span>
                </span>
              ))}
            </button>
          );
        })}
      </div>

      {openDate ? (
        <DayDialog
          date={openDate}
          entries={byDate.get(openDate) ?? []}
          courses={courses}
          onSave={async (values, editingId) => {
            try {
              setError(null);
              if (editingId) {
                const existing = myEntries.find((p) => p.id === editingId);
                if (existing) {
                  await updatePlanning(editingId, values);
                }
              } else {
                await insertPlanning({
                  id: crypto.randomUUID(),
                  teacherId: teacher.id,
                  date: openDate,
                  ...values,
                });
              }
              await refresh();
              setOpenDate(null);
            } catch (err) {
              setError(errorMessage(err));
              setOpenDate(null);
            }
          }}
          onDeleteRequest={(entry) => setDeleteTarget(entry)}
          onClose={() => setOpenDate(null)}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the logged entry of{" "}
              {deleteTarget?.date}
              {deleteTarget?.course ? ` for “${deleteTarget.course}”` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  setError(null);
                  await deletePlanning(deleteTarget.id);
                  await refresh();
                } catch (err) {
                  setError(errorMessage(err));
                }
                setDeleteTarget(null);
              }}
            >
              Delete Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
