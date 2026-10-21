import { useEffect, useState, type ComponentType } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
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
import { Input } from "@/components/ui/input";
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
  listTeacherCourses,
  teacherCourseAssignment,
  updatePlanning,
} from "@/lib/api";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { cn } from "@/lib/utils";
import type { PlanningRecord } from "./planning";
import { loadCurrentTeacher } from "./currentTeacher";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PlanningView = "grid" | "list";
type PlanningScope = "week" | "all";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
}

/** Small segmented control used for the view and scope switches. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Tuesday, Oct 20" — the year is only added for the all-sessions list. */
function dayHeading(dateKey: string, withYear: boolean): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

interface PlanningOptions {
  courses: string[];
  classes: string[];
}

function classLabel(program: string, training: string): string {
  return [program, training].filter(Boolean).join(" · ");
}

/**
 * Course and class choices for the entry form. Classes come from the teacher's
 * own courses, with the profile assignment added so a teacher who has no
 * courses yet can still log a session for their class.
 */
async function planningOptions(teacherId: string): Promise<PlanningOptions> {
  const [all, assignment] = await Promise.all([
    listTeacherCourses({ teacherId }),
    teacherCourseAssignment(teacherId),
  ]);
  const classes = new Set<string>();
  for (const course of all) {
    const label = classLabel(course.program, course.training);
    if (label) classes.add(label);
  }
  const assigned = classLabel(assignment.program, assignment.training);
  if (assigned) classes.add(assigned);
  return {
    courses: [...new Set(all.map((c) => c.name))],
    classes: [...classes].sort((a, b) => a.localeCompare(b)),
  };
}

function normalizeClock(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

/** Splits a stored "08:30 - 10:00" back into two time inputs. */
function parseSessionTime(value?: string): { start: string; end: string } {
  const range = value?.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (range) {
    return { start: normalizeClock(range[1]), end: normalizeClock(range[2]) };
  }
  const single = value?.match(/(\d{1,2}:\d{2})/);
  return { start: single ? normalizeClock(single[1]) : "", end: "" };
}

function formatSessionTime(start: string, end: string): string | undefined {
  if (start && end) return `${start} - ${end}`;
  return start || end || undefined;
}

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

const NO_CLASS = "__none";

interface EntryFormValues {
  course?: string;
  className?: string;
  sessionTime?: string;
  content: string;
}

interface EntryFormProps {
  initial?: PlanningRecord;
  courses: string[];
  classes: string[];
  submitLabel: string;
  showCancel: boolean;
  onSubmit: (values: EntryFormValues) => void;
  onCancel: () => void;
}

function EntryForm({
  initial,
  courses,
  classes,
  submitLabel,
  showCancel,
  onSubmit,
  onCancel,
}: EntryFormProps) {
  const [course, setCourse] = useState(initial?.course ?? "");
  // A teacher with a single assigned class gets it prefilled; otherwise the
  // field stays blank until they pick one.
  const [className, setClassName] = useState(
    initial?.className ?? (classes.length === 1 ? classes[0] : ""),
  );
  const initialTime = parseSessionTime(initial?.sessionTime);
  const [startTime, setStartTime] = useState(initialTime.start);
  const [endTime, setEndTime] = useState(initialTime.end);
  const [content, setContent] = useState(initial?.content ?? "");

  const timeInvalid = Boolean(startTime && endTime && endTime < startTime);
  const valid = content.trim() !== "" && !timeInvalid;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Class</Label>
        <Select
          value={className || NO_CLASS}
          onValueChange={(value) =>
            setClassName(value === NO_CLASS ? "" : (value ?? ""))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                classes.length > 0 ? "Select class" : "No class assigned"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLASS}>No class</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
        <Label htmlFor="log-start-time">Time</Label>
        <div className="flex items-center gap-2">
          <Input
            id="log-start-time"
            type="time"
            className="w-32"
            aria-label="Session start time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            id="log-end-time"
            type="time"
            className="w-32"
            aria-label="Session end time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        {timeInvalid ? (
          <p className="text-xs text-destructive">
            End time must be after the start time.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Optional. Fill both sides for a time range such as 08:30 - 10:00.
          </p>
        )}
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
            onSubmit({
              course: course || undefined,
              className: className || undefined,
              sessionTime: formatSessionTime(startTime, endTime),
              content: content.trim(),
            })
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
  classes: string[];
  /** Opens the dialog straight into the edit form for this entry. */
  initialEditingId?: string;
  onSave: (values: EntryFormValues, editingId: string | null) => void;
  onDeleteRequest: (entry: PlanningRecord) => void;
  onClose: () => void;
}

function DayDialog({
  date,
  entries,
  courses,
  classes,
  initialEditingId,
  onSave,
  onDeleteRequest,
  onClose,
}: DayDialogProps) {
  const [formOpen, setFormOpen] = useState(
    entries.length === 0 || Boolean(initialEditingId),
  );
  const [editingId, setEditingId] = useState<string | null>(
    initialEditingId ?? null,
  );

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
            classes={classes}
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {e.course || "—"}
                      </p>
                      {(e.sessionTime || e.className) && (
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {e.sessionTime && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {e.sessionTime}
                            </span>
                          )}
                          {e.className && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {e.className}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
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
  const [classes, setClasses] = useState<string[]>([]);
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<PlanningView>("grid");
  const [scope, setScope] = useState<PlanningScope>("week");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{
    date: string;
    editingId?: string;
  } | null>(null);
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
          const [all, options] = await Promise.all([
            listPlanning(),
            planningOptions(record.id),
          ]);
          if (cancelled) return;
          setEntries(all);
          setCourses(options.courses);
          setClasses(options.classes);
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
      const [all, options] = await Promise.all([
        listPlanning(),
        planningOptions(teacher.id),
      ]);
      setEntries(all);
      setCourses(options.courses);
      setClasses(options.classes);
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
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        // Entries without a time sit after timed sessions in the same day.
        (a.sessionTime ?? "99:99").localeCompare(b.sessionTime ?? "99:99"),
    );

  const byDate = new Map<string, PlanningRecord[]>();
  for (const p of weekEntries) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }

  // Every entry of the open day (not only the viewed week) so the dialog can
  // edit an entry reached through the all-sessions list.
  const dialogEntries = dialog
    ? myEntries
        .filter((p) => p.date === dialog.date)
        .sort((a, b) =>
          (a.sessionTime ?? "99:99").localeCompare(b.sessionTime ?? "99:99"),
        )
    : [];

  const todayKey = dateKeyOf(new Date());
  // "+ Add Entry" targets today when it is visible; inside another week it
  // falls back to that week's Monday so the new entry stays in view.
  const addEntryDate =
    scope === "week" && !weekKeySet.has(todayKey) ? weekKeys[0] : todayKey;

  // Current week reads as an agenda (Mon → Sun); the full history reads newest
  // first so recent sessions are on top.
  const listSource =
    scope === "week"
      ? weekEntries
      : [...myEntries].sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (a.sessionTime ?? "99:99").localeCompare(
              b.sessionTime ?? "99:99",
            ),
        );

  const searchTerm = query.trim().toLowerCase();
  const listEntries = searchTerm
    ? listSource.filter((p) =>
        [p.course, p.className, p.content, p.date].some((field) =>
          field?.toLowerCase().includes(searchTerm),
        ),
      )
    : listSource;

  const listGroups: { date: string; entries: PlanningRecord[] }[] = [];
  for (const entry of listEntries) {
    const group = listGroups[listGroups.length - 1];
    if (group && group.date === entry.date) group.entries.push(entry);
    else listGroups.push({ date: entry.date, entries: [entry] });
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

  const exportHeaders = ["Date", "Time", "Class", "Course", "Topic covered"];
  const exportRows = weekEntries.map((p) => [
    p.date,
    p.sessionTime ?? "",
    p.className ?? "",
    p.course ?? "",
    p.content,
  ]);
  const fileStem = `planning-${weekKeys[0]}`;

  const exportExcel = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      exportHeaders,
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
      head: [exportHeaders],
      body: exportRows,
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 24 },
        2: { cellWidth: 45 },
        3: { cellWidth: 40 },
      },
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
        <Segmented
          label="Planning view"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "Grid View", icon: LayoutGrid },
            { value: "list", label: "Linear View", icon: List },
          ]}
        />
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

      {view === "grid" ? (
        <div className="mt-4 grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const key = weekKeys[i];
            const dayEntries = byDate.get(key) ?? [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDialog({ date: key })}
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
                    {e.sessionTime && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-accent-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">{e.sessionTime}</span>
                      </span>
                    )}
                    {e.className && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="truncate">{e.className}</span>
                      </span>
                    )}
                    <span className="block truncate text-xs font-medium text-accent-foreground">
                      {e.course || "Logged session"}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {e.content}
                    </span>
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Linear view scope"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "week", label: "Current Week" },
                  { value: "all", label: "All Sessions" },
                ]}
              />
              <span className="text-xs text-muted-foreground">
                {listEntries.length}{" "}
                {listEntries.length === 1 ? "session" : "sessions"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search course, class or topic…"
                  aria-label="Search planning entries"
                  className="w-64 pl-8"
                />
              </div>
              <Button size="sm" onClick={() => setDialog({ date: addEntryDate })}>
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </div>
          </div>

          {listGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {searchTerm
                ? "No sessions match your search."
                : scope === "week"
                  ? "No sessions logged this week."
                  : "No sessions logged yet."}
            </div>
          ) : (
            <div className="space-y-5">
              {listGroups.map((group) => (
                <section key={group.date} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDialog({ date: group.date })}
                      className="text-sm font-semibold hover:underline"
                      title="Add an entry to this day"
                    >
                      {dayHeading(group.date, scope === "all")}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {group.entries.length}{" "}
                      {group.entries.length === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {group.entries.map((entry) => (
                      <li key={entry.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {entry.sessionTime ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {entry.sessionTime}
                                </span>
                              ) : null}
                              <span className="text-sm font-medium">
                                {entry.course || "Logged session"}
                              </span>
                            </div>
                            {entry.className ? (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3 shrink-0" />
                                {entry.className}
                              </p>
                            ) : null}
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {entry.content}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setDialog({
                                  date: entry.date,
                                  editingId: entry.id,
                                })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Delete entry ${entry.course ?? ""}`.trim()}
                              onClick={() => setDeleteTarget(entry)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog ? (
        <DayDialog
          key={`${dialog.date}:${dialog.editingId ?? "new"}`}
          date={dialog.date}
          entries={dialogEntries}
          courses={courses}
          classes={classes}
          initialEditingId={dialog.editingId}
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
                  date: dialog.date,
                  ...values,
                });
              }
              await refresh();
              setDialog(null);
            } catch (err) {
              setError(errorMessage(err));
              setDialog(null);
            }
          }}
          onDeleteRequest={(entry) => setDeleteTarget(entry)}
          onClose={() => setDialog(null)}
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
