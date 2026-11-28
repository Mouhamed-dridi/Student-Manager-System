import { useEffect, useState, type ComponentType } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Paperclip,
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
import { DataError, DataLoading } from "@/components/DataState";
import PlanningEntryForm from "@/components/PlanningEntryForm";
import { PlanningLocationBadge } from "@/components/PlanningLocationBadge";
import { PlanningMeetingLink } from "@/components/PlanningMeetingLink";
import { PlanningSessionTypeBadge } from "@/components/PlanningSessionTypeBadge";
import { useI18n } from "@/lib/i18n";
import {
  classNameFor,
  deletePlanning,
  errorMessage,
  insertPlanning,
  listExams,
  listPlanning,
  listTeacherCourses,
  teacherAssignedClasses,
  type TeacherAssignedClass,
  type TeacherCourseRecord,
  updatePlanning,
  uploadCourseMaterial,
} from "@/lib/api";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { cn } from "@/lib/utils";
import {
  planningCategoryFor,
  planningCategoryKey,
  planningSessionTypeKey,
} from "./planning";
import type {
  PlanningCategory,
  PlanningClassOption,
  PlanningEntryValues,
  PlanningRecord,
} from "./planning";
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

type PlanningFilter = "all" | PlanningCategory;

/** Filter pills of the toolbar: all three entry kinds, or one of them. */
const FILTER_OPTIONS: { value: PlanningFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "course", label: "Courses" },
  { value: "exam", label: "Exams" },
  { value: "pfe", label: "PFE" },
];

/**
 * The category pill on every logged entry (`COURSE`, `EXAM`, `PFE`). Strictly
 * zinc: the category is the only emphasis, so a dense week stays readable
 * without a colour per session kind.
 */
function PlanningCategoryPill({
  category,
}: {
  category: PlanningCategory;
}) {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase dark:border-zinc-700 dark:text-zinc-400">
      {t(planningCategoryKey(category))}
    </span>
  );
}

/** Paperclip badge shown when a Course & Materials entry carries a file/link. */
function PlanningMaterialBadge({ entry }: { entry: PlanningRecord }) {
  const { t } = useI18n();
  if (!entry.materialUrl) return null;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {entry.materialName || t("Material attached")}
      </span>
    </span>
  );
}

/** Same badge as a link, for the linear view where the card body is not a button. */
function PlanningMaterialLink({ entry }: { entry: PlanningRecord }) {
  const { t } = useI18n();
  if (!entry.materialUrl) return null;
  return (
    <a
      href={entry.materialUrl}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {entry.materialName || t("Lesson material")}
      </span>
    </a>
  );
}

/** "Tuesday, Oct 20" — the year is only added for the all-sessions list. */
function dayHeading(
  dateKey: string,
  withYear: boolean,
  locale: string,
): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

interface PlanningOptions {
  courses: string[];
  classes: PlanningClassOption[];
}

/**
 * Course and class choices for the entry form.
 * Uses the exact same multi-class resolver (branch_materials + planning)
 * used on My Class, so a teacher sees all of their assigned CAP, BTP, and BTS classes.
 */
async function planningOptions(
  teacherId: string,
  teacherName = "",
): Promise<PlanningOptions> {
  const [assigned, allCourses, exams] = await Promise.all([
    teacherAssignedClasses(teacherId, teacherName).catch(
      () => [] as TeacherAssignedClass[],
    ),
    listTeacherCourses({ teacherId }).catch(() => [] as TeacherCourseRecord[]),
    // Exam subjects complete the Matière suggestions: `teacherAssignedClasses`
    // already folds in `branch_materials` and past `planning`, but a teacher who
    // only ever created exams for a module would otherwise not see it.
    listExams().catch(() => []),
  ]);
  const classes = new Map<string, PlanningClassOption>();

  // 1. All classes this teacher is staffed in (branch_materials + planning)
  for (const c of assigned) {
    const label = classNameFor(c.program || c.level, c.training || c.name);
    if (!label) continue;
    classes.set(label, {
      label,
      programId: c.programId || undefined,
      trainingId: c.trainingId || undefined,
      branchId: c.id,
      materials: c.materials,
    });
  }

  // 2. Also keep any courses this teacher has created
  for (const course of allCourses) {
    const label = classNameFor(course.program, course.training);
    if (!label) continue;
    const existing = classes.get(label);
    if (!existing) {
      classes.set(label, {
        label,
        programId: course.programId || undefined,
        trainingId: course.trainingId || undefined,
      });
    }
  }

  const allSuggestions = new Set<string>();
  for (const c of assigned) {
    for (const m of c.materials) {
      if (m.trim()) allSuggestions.add(m.trim());
    }
  }
  for (const course of allCourses) {
    if (course.name.trim()) allSuggestions.add(course.name.trim());
  }
  for (const exam of exams) {
    if (exam.teacherId !== teacherId) continue;
    const subject = exam.subject?.trim();
    if (subject) allSuggestions.add(subject);
  }

  return {
    courses: [...allSuggestions],
    classes: [...classes.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  };
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

interface DayDialogProps {
  date: string;
  entries: PlanningRecord[];
  courses: string[];
  classes: PlanningClassOption[];
  /** Opens the dialog straight into the edit form for this entry. */
  initialEditingId?: string;
  /** Opens the dialog straight into the add form for this day. */
  initialAdd?: boolean;
  /** Category tab the add form opens on (the page's active filter). */
  defaultCategory: PlanningCategory;
  onSave: (values: PlanningEntryValues, editingId: string | null) => void;
  onDeleteRequest: (entry: PlanningRecord) => void;
  onClose: () => void;
  /** Uploads a daily lesson material for the Course & Materials tab. */
  onUploadMaterial: (file: File) => Promise<{ url: string; name: string }>;
}

function DayDialog({
  date,
  entries,
  courses,
  classes,
  initialEditingId,
  initialAdd,
  defaultCategory,
  onSave,
  onDeleteRequest,
  onClose,
  onUploadMaterial,
}: DayDialogProps) {
  const { t, language } = useI18n();
  const [formOpen, setFormOpen] = useState(
    entries.length === 0 || Boolean(initialEditingId || initialAdd),
  );
  const [editingId, setEditingId] = useState<string | null>(
    initialEditingId ?? null,
  );

  const editing = editingId
    ? (entries.find((e) => e.id === editingId) ?? null)
    : null;

  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString(
    language === "fr" ? "fr-FR" : "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* Landscape dialog: the form lays its fields out in two columns, so the
          popup is wide (and keeps a clean sheet shape on phones). The header
          and the action bar sit outside the scrolling body, which is why a
          session can be filled out without losing the date, the category tabs
          or "Save". */}
      <DialogContent className="box-border w-[95vw] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl sm:p-0 lg:max-w-5xl">
        <div className="flex max-h-[92vh] min-h-0 flex-col">
          <DialogHeader className="shrink-0 gap-1 border-b border-zinc-200 px-6 py-4 pr-12 dark:border-zinc-800">
            <DialogTitle>{t("Planning entry")}</DialogTitle>
            <DialogDescription>{longDate}</DialogDescription>
          </DialogHeader>

          {formOpen || entries.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
              <PlanningEntryForm
                key={editingId ?? "new"}
                initial={editing ?? undefined}
                courses={courses}
                classes={classes}
                submitLabel={editingId ? t("Save Changes") : t("Add Entry")}
                showCancel
                showCategory
                defaultCategory={defaultCategory}
                layout="landscape"
                onUploadMaterial={onUploadMaterial}
                onSubmit={(values) => onSave(values, editingId)}
                onCancel={() => {
                  // Cancel steps back to the day's session list, and closes the
                  // dialog when there is no list to go back to.
                  if (editingId) {
                    setEditingId(null);
                    setFormOpen(false);
                  } else if (entries.length > 0) {
                    setFormOpen(false);
                  } else {
                    onClose();
                  }
                }}
              />
            </div>
          ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <PlanningCategoryPill
                          category={planningCategoryFor(e.sessionType)}
                        />
                        <span className="truncate text-sm font-medium">
                          {e.course || t("Logged session")}
                        </span>
                        <PlanningSessionTypeBadge
                          sessionType={e.sessionType}
                          label={e.customSessionType}
                        />
                      </div>
                      {(e.sessionTime ||
                        e.className ||
                        e.roomName ||
                        e.materialUrl ||
                        e.sessionType === "Online") && (
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {e.sessionTime && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {e.sessionTime}
                            </span>
                          )}
                          {e.roomName && (
                            <PlanningLocationBadge
                              room={e.roomName}
                              sessionType={e.sessionType}
                              monochrome
                            />
                          )}
                          {e.className && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {e.className}
                            </span>
                          )}
                          <PlanningMaterialBadge entry={e} />
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
                        {t("Edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("Delete entry {course}", {
                          course: e.course || "",
                        }).trim()}
                        onClick={() => onDeleteRequest(e)}
                      >
                        <Trash2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                      </Button>
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {e.content}
                  </p>
                  {e.meetingUrl ? (
                    <div className="mt-1.5">
                      <PlanningMeetingLink url={e.meetingUrl} monochrome />
                    </div>
                  ) : null}
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
              {t("Add Entry")}
            </Button>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanningPage() {
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [entries, setEntries] = useState<PlanningRecord[] | null>(null);
  const [courses, setCourses] = useState<string[]>([]);
  const [classes, setClasses] = useState<PlanningClassOption[]>([]);
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<PlanningView>("grid");
  const [scope, setScope] = useState<PlanningScope>("week");
  const [filter, setFilter] = useState<PlanningFilter>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{
    date: string;
    editingId?: string;
    initialAdd?: boolean;
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
            planningOptions(record.id, record.fullName),
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
        <h2 className="text-2xl font-semibold">{t("Planning")}</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "Your teacher record could not be found. It may have been removed by the administration.",
          )}
        </p>
      </div>
    );
  }

  if (teacher === undefined || entries === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">{t("Planning")}</h2>
        <DataLoading label={t("Loading planning…")} />
      </div>
    );
  }

  const refresh = async () => {
    try {
      setError(null);
      const [all, options] = await Promise.all([
        listPlanning(),
        planningOptions(teacher.id, teacher.fullName),
      ]);
      setEntries(all);
      setCourses(options.courses);
      setClasses(options.classes);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const myEntries = entries.filter((p) => p.teacherId === teacher.id);

  // The category pills narrow the week, the linear view and the export at once,
  // so what is on screen is exactly what a teacher hands out.
  const visibleEntries =
    filter === "all"
      ? myEntries
      : myEntries.filter(
          (p) => planningCategoryFor(p.sessionType) === filter,
        );

  const materialUploader = (file: File) =>
    uploadCourseMaterial(file, file.name, teacher.id).then((url) => ({
      url,
      name: file.name,
    }));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    return d;
  });
  const weekKeys = weekDays.map(dateKeyOf);
  const weekKeySet = new Set(weekKeys);

  const weekEntries = visibleEntries
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
      : [...visibleEntries].sort(
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

  const exportHeaders = [
    t("Date"),
    t("Time"),
    t("Category"),
    t("Class"),
    t("Course"),
    t("Session Type"),
    t("Topic covered"),
    t("Lesson material"),
  ];
  const exportRows = weekEntries.map((p) => [
    p.date,
    p.sessionTime ?? "",
    t(planningCategoryKey(planningCategoryFor(p.sessionType))),
    p.className ?? "",
    p.course ?? "",
    p.customSessionType?.trim() || t(planningSessionTypeKey(p.sessionType)),
    p.content,
    p.materialUrl
      ? [p.materialName, p.materialUrl].filter(Boolean).join(" — ")
      : "",
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
    // Landscape: the category and the attached material add two columns, so the
    // portrait page would squeeze the topic into an unreadable strip.
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${t("Planning")} — ${rangeLabel}`, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [exportHeaders],
      body: exportRows,
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 26 },
        2: { cellWidth: 24 },
        3: { cellWidth: 46 },
        4: { cellWidth: 44 },
        5: { cellWidth: 26 },
      },
    });
    doc.save(`${fileStem}.pdf`);
  };

  return (
    // Full-height column so the week grid eats the rest of the viewport
    // instead of collapsing to its content height in the top third.
    <div className="flex min-h-[calc(100vh-5rem)] w-full min-w-0 flex-col">
      <div>
        <h2 className="text-2xl font-semibold">{t("Planning")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Click any day to log what was studied with your class.")}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("Previous week")}
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
            aria-label={t("Next week")}
            onClick={() => stepWeek(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={t("Filter by category")}
            value={filter}
            onChange={setFilter}
            options={FILTER_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.label),
            }))}
          />
          <Segmented
            label={t("Planning view")}
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: t("Grid View"), icon: LayoutGrid },
              { value: "list", label: t("Linear View"), icon: List },
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
              {t("Export as Excel")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={weekEntries.length === 0}
              onClick={exportPdf}
            >
              <FileText className="h-4 w-4" />
              {t("Export as PDF")}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {view === "grid" ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col pb-1">
          <div className="grid flex-1 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {weekDays.map((d, i) => {
              const key = weekKeys[i];
              const dayEntries = byDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex h-full min-h-[540px] min-w-0 flex-col justify-between rounded-lg border p-3.5",
                    isToday
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-800",
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDialog({ date: key })}
                      className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <span
                        className={cn(
                          "block text-[11px] font-semibold tracking-wide uppercase",
                          isToday
                            ? "text-zinc-900 dark:text-zinc-100"
                            : "text-muted-foreground",
                        )}
                      >
                        {t(WEEKDAYS[i])} {d.getDate()}
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      {isToday ? (
                        <span className="shrink-0 rounded-full border border-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase dark:border-zinc-100">
                          {t("Today")}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("Add session on {date}", { date: key })}
                        onClick={() => setDialog({ date: key, initialAdd: true })}
                        className="h-6 w-6 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="my-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {dayEntries.map((e) => (
                      // The visual card is a wrapper, not a button, so the Teams
                      // link can be a real anchor outside the clickable area:
                      // joining never opens the editor, and it stays keyboard
                      // reachable (a link nested in a button is not).
                      <div
                        key={e.id}
                        className="w-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setDialog({ date: key, editingId: e.id })
                          }
                          className="block w-full min-w-0 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <span className="flex flex-wrap items-center gap-1">
                            <PlanningCategoryPill
                              category={planningCategoryFor(e.sessionType)}
                            />
                            <PlanningSessionTypeBadge
                              sessionType={e.sessionType}
                              label={e.customSessionType}
                            />
                          </span>
                          {(e.sessionTime ||
                            e.roomName ||
                            e.sessionType === "Online") && (
                            <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-medium">
                              {e.sessionTime && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>{e.sessionTime}</span>
                                </span>
                              )}
                              <PlanningLocationBadge
                                room={e.roomName}
                                sessionType={e.sessionType}
                                monochrome
                              />
                            </span>
                          )}
                          {e.className && (
                            <span className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground">
                              <Users className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="min-w-0 break-words">
                                {e.className}
                              </span>
                            </span>
                          )}
                          <span className="mt-1 block text-xs font-medium break-words">
                            {e.course || t("Logged session")}
                          </span>
                          {e.content ? (
                            <span className="mt-0.5 block text-xs break-words whitespace-pre-wrap text-muted-foreground">
                              {e.content}
                            </span>
                          ) : null}
                          {e.materialUrl ? (
                            <span className="mt-1.5 block">
                              <PlanningMaterialBadge entry={e} />
                            </span>
                          ) : null}
                        </button>
                        {e.meetingUrl ? (
                          <div className="px-2 pb-1.5">
                            <PlanningMeetingLink url={e.meetingUrl} monochrome />
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {dayEntries.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setDialog({ date: key, initialAdd: true })}
                        aria-label={t("Add session on {date}", { date: key })}
                        className="group flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-10 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-100"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-zinc-300 transition-colors group-hover:border-zinc-500 group-hover:bg-white dark:border-zinc-700 dark:group-hover:border-zinc-500 dark:group-hover:bg-zinc-800">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                        <span>{t("Add a session")}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label={t("Linear view scope")}
                value={scope}
                onChange={setScope}
                options={[
                  { value: "week", label: t("Current Week") },
                  { value: "all", label: t("All Sessions") },
                ]}
              />
              <span className="text-xs text-muted-foreground">
                {listEntries.length}{" "}
                {t(listEntries.length === 1 ? "session" : "sessions")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search course, class or topic…")}
                  aria-label={t("Search planning entries")}
                  className="w-64 pl-8"
                />
              </div>
              <Button size="sm" onClick={() => setDialog({ date: addEntryDate })}>
                <Plus className="h-4 w-4" />
                {t("Add Entry")}
              </Button>
            </div>
          </div>

          {listGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {searchTerm
                ? t("No sessions match your search.")
                : scope === "week"
                  ? t("No sessions logged this week.")
                  : t("No sessions logged yet.")}
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
                      title={t("Add an entry to this day")}
                    >
                      {dayHeading(group.date, scope === "all", locale)}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {group.entries.length}{" "}
                      {t(group.entries.length === 1 ? "entry" : "entries")}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {group.entries.map((entry) => (
                      <li key={entry.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <PlanningCategoryPill
                                category={planningCategoryFor(
                                  entry.sessionType,
                                )}
                              />
                              <PlanningSessionTypeBadge
                                sessionType={entry.sessionType}
                                label={entry.customSessionType}
                              />
                              {entry.sessionTime ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {entry.sessionTime}
                                </span>
                              ) : null}
                              <PlanningLocationBadge
                                room={entry.roomName}
                                sessionType={entry.sessionType}
                                monochrome
                              />
                              <span className="min-w-0 truncate text-sm font-medium">
                                {entry.className || entry.course
                                  ? `${entry.className ?? ""}${entry.className && entry.course ? " · " : ""}${entry.course ?? ""}`
                                  : t("Logged session")}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {entry.content}
                            </p>
                            <PlanningMaterialLink entry={entry} />
                            {entry.meetingUrl ? (
                              <div>
                                <PlanningMeetingLink
                                  url={entry.meetingUrl}
                                  monochrome
                                />
                              </div>
                            ) : null}
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
                              {t("Edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("Delete entry {course}", {
                                course: entry.course ?? "",
                              }).trim()}
                              onClick={() => setDeleteTarget(entry)}
                            >
                              <Trash2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
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
          key={`${dialog.date}:${dialog.editingId ?? (dialog.initialAdd ? "add" : "list")}`}
          date={dialog.date}
          entries={dialogEntries}
          courses={courses}
          classes={classes}
          initialEditingId={dialog.editingId}
          initialAdd={dialog.initialAdd}
          // "+" on a week column opens the tab of the active filter: PFE opens
          // Planning PFE, Exams opens Planification d'examen, otherwise Course.
          defaultCategory={filter === "all" ? "course" : filter}
          onUploadMaterial={materialUploader}
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
                  ...values,
                  id: crypto.randomUUID(),
                  // The teacher portal never reassigns, so the session always
                  // belongs to the signed-in teacher.
                  teacherId: teacher.id,
                  date: dialog.date,
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
            <AlertDialogTitle>{t("Delete entry?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.course
                ? t(
                    "This will permanently remove the logged entry of {date} for “{course}”.",
                    { date: deleteTarget.date, course: deleteTarget.course },
                  )
                : t(
                    "This will permanently remove the logged entry of {date}.",
                    { date: deleteTarget?.date ?? "" },
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
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
              {t("Delete Entry")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
