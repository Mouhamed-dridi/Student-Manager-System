// Operator "Branches" — step 2: the weekly timetable of one branch.
//
// The grid is Monday to Saturday (a seventh column appears only when the branch
// actually has Sunday sessions), one row per fixed time slot. Sessions written
// with another window get a row of their own and untimed ones fall into a final
// "No time set" row, so the grid can never hide a session.
//
// Every cell has an add button, every card opens the shared entry form (where
// the day can be changed, which is how a session is moved), and the form warns
// about a clashing teacher, room or class before saving. Clashes are reported,
// never blocked: a shared room or a co-taught group is legitimate.
//
// The Planification section opens this timetable under one of its three tabs
// (Emploi du temps / Emploi des examens / Planning PFE): `sessionTypes` filters
// the grid to that tab, `examMode` sends the '+' to AddExamSessionModal (the
// exam field set: no topic, no internal note) and `pfeMode` sends both '+' and
// a click on a PFE card to AddPFESessionModal (date, slot, class, room,
// PFE/STAGE/Soutenance and a multi-teacher jury, no subject or topic). The
// Branches page passes none of them and keeps showing every session of the
// week.
//
// Reads and writes go through src/lib/api, like every other page.

import { Fragment, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Printer,
  Trash2,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataError } from "@/components/DataState";
import PlanningEntryForm from "@/components/PlanningEntryForm";
import AddExamSessionModal from "@/pages/planification/AddExamSessionModal";
import AddPFESessionModal from "@/pages/planification/AddPFESessionModal";
import type { PlanningEntryDraft } from "@/components/PlanningEntryForm";
import { PlanningLocationBadge } from "@/components/PlanningLocationBadge";
import { PlanningSessionTypeBadge } from "@/components/PlanningSessionTypeBadge";
import { useNestedView } from "@/hooks/viewHistory";
import { useT } from "@/lib/i18n";
import {
  classNameFor,
  deletePlanning,
  errorMessage,
  insertPlanning,
  updatePlanning,
} from "@/lib/api";
import { subjectTone } from "@/lib/subjectColors";
import { cn } from "@/lib/utils";
import {
  addDays,
  dateKeyOf,
  formatLongDate,
  formatWeekRange,
  startOfWeek,
  WEEKDAY_LABELS,
} from "@/pages/student-portal/scheduleDates";
import { sessionInTraining } from "@/pages/planification/tracks";
import {
  NO_TIME_SLOT,
  PLANNING_TIME_SLOTS,
  planningSlotKey,
  planningTimeRange,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningClassOption,
  PlanningEntryValues,
  PlanningRecord,
  PlanningSessionType,
} from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type { Branch } from "./BranchesPage";
import {
  findPlanningConflicts,
  planningConflictMap,
} from "./planningConflicts";
import type { PlanningConflict } from "./planningConflicts";
import { PLANNING_SUBJECTS, qualifiedTeacherIds } from "./planningSubjects";

interface BranchPlanningPageProps {
  branch: Branch;
  /** Every planning row, all branches: classroom clashes cross branches. */
  planning: PlanningRecord[];
  teachers: Teacher[];
  courses: TeacherCourseRecord[];
  /** Week to open on; defaults to the current week. */
  initialWeekStart?: Date;
  /** Label of the in-page back button (the header arrow is shared). */
  backLabel?: string;
  onBack: () => void;
  /** Refresh the parent's data after a write so the two views cannot drift. */
  onReload: () => Promise<void>;
  /**
   * Session types this timetable shows (the Planification tab it was opened
   * from). Omitted by the Branches page, which shows the whole week.
   */
  sessionTypes?: readonly PlanningSessionType[];
  /** Exam tab: '+' opens the specialised exam dialog instead of the entry form. */
  examMode?: boolean;
  /**
   * PFE tab: '+' and a card click open the specialised PFE dialog (jury panel,
   * PFE/STAGE/Soutenance kinds, no subject or topic) instead of the entry form.
   */
  pfeMode?: boolean;
}

const ALL_CLASSES = "__all";
const NO_CLASS = "__none";

function sortByTime(a: PlanningRecord, b: PlanningRecord): number {
  return (
    (planningTimeRange(a.sessionTime)?.start ?? Number.MAX_SAFE_INTEGER) -
      (planningTimeRange(b.sessionTime)?.start ?? Number.MAX_SAFE_INTEGER) ||
    (a.course ?? "").localeCompare(b.course ?? "")
  );
}

function matchesClassFilter(entry: PlanningRecord, filter: string): boolean {
  if (filter === ALL_CLASSES) return true;
  const label = entry.className?.trim() ?? "";
  if (filter === NO_CLASS) return label === "";
  return label === filter;
}

export default function BranchPlanningPage({
  branch,
  planning,
  teachers,
  courses,
  initialWeekStart,
  backLabel,
  onBack,
  onReload,
  sessionTypes,
  examMode = false,
  pfeMode = false,
}: BranchPlanningPageProps) {
  const t = useT();
  const [cursor, setCursor] = useState(() =>
    startOfWeek(initialWeekStart ?? new Date()),
  );
  const [classFilter, setClassFilter] = useState(ALL_CLASSES);
  const [dialog, setDialog] = useState<{
    date: string;
    slot?: string;
    editingId?: string;
  } | null>(null);
  const [draft, setDraft] = useState<PlanningEntryDraft | null>(null);
  // Exam tab only: the '+' / "Add session" path of a specialised dialog.
  const [examDialog, setExamDialog] = useState<{
    date: string;
    slot?: string;
  } | null>(null);
  // PFE tab: the same specialised-dialog path, plus editing an existing card.
  const [pfeDialog, setPfeDialog] = useState<{
    date: string;
    slot?: string;
    editingId?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanningRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useNestedView(true, "branch-planning", t("Branch timetable"), onBack);

  // Print / "Save as PDF" keeps only the timetable: the body class switches the
  // `@media print` rules on (see src/index.css), so the sidebar, the week
  // navigator and the add buttons never reach the page. Listening to the
  // browser events covers Ctrl+P as well as the header button.
  useEffect(() => {
    const enterPrint = () =>
      document.body.classList.add("planning-printing");
    const exitPrint = () =>
      document.body.classList.remove("planning-printing");
    window.addEventListener("beforeprint", enterPrint);
    window.addEventListener("afterprint", exitPrint);
    return () => {
      window.removeEventListener("beforeprint", enterPrint);
      window.removeEventListener("afterprint", exitPrint);
      document.body.classList.remove("planning-printing");
    };
  }, []);

  const teacherById = new Map(
    teachers.map((teacher) => [teacher.id, teacher.fullName]),
  );

  const branchLabel = classNameFor(branch.programCode, branch.name);
  const branchName = branchLabel || branch.name;

  const branchSessions = planning
    .filter((entry) =>
      sessionInTraining(entry, { id: branch.trainingId, name: branch.name }),
    )
    // The Planification tab decides which session kinds this grid draws, so
    // lessons, exam sittings and PFE defences never mix in one week.
    .filter((entry) => !sessionTypes || sessionTypes.includes(entry.sessionType))
    .sort((a, b) => b.date.localeCompare(a.date));

  const classOptionsForFilter = [
    ...new Set(
      branchSessions
        .map((entry) => entry.className?.trim())
        .filter((label): label is string => Boolean(label)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const hasUnclassed = branchSessions.some((entry) => !entry.className?.trim());
  // Base UI's Select.Value prints the raw `__all` sentinel unless the items
  // list maps it to a label, so the filter's options are built once, translated.
  const classFilterItems = [
    { value: ALL_CLASSES, label: t("All classes") },
    ...classOptionsForFilter.map((label) => ({ value: label, label })),
    ...(hasUnclassed ? [{ value: NO_CLASS, label: t("No class") }] : []),
  ];

  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(cursor, index),
  );
  const weekKeys = weekDays.map(dateKeyOf);
  const weekKeySet = new Set(weekKeys);

  const visibleSessions = branchSessions.filter(
    (entry) =>
      weekKeySet.has(entry.date?.slice(0, 10)) &&
      matchesClassFilter(entry, classFilter),
  );
  const weekSessions = visibleSessions.sort(sortByTime);

  // Sunday is not part of the timetable column set, but a session stored there
  // must still be reachable.
  const showSunday = branchSessions.some(
    (entry) => entry.date?.slice(0, 10) === weekKeys[6],
  );
  const dayColumns = weekDays
    .slice(0, showSunday ? 7 : 6)
    .map((day, index) => ({ key: weekKeys[index], date: day }));

  const extraSlots = [
    ...new Set(
      weekSessions
        .map((entry) => planningSlotKey(entry.sessionTime))
        .filter(
          (slot) =>
            slot !== NO_TIME_SLOT &&
            !(PLANNING_TIME_SLOTS as readonly string[]).includes(slot),
        ),
    ),
  ].sort(
    (a, b) =>
      (planningTimeRange(a)?.start ?? Number.MAX_SAFE_INTEGER) -
      (planningTimeRange(b)?.start ?? Number.MAX_SAFE_INTEGER),
  );
  const hasUntimed = weekSessions.some(
    (entry) => planningSlotKey(entry.sessionTime) === NO_TIME_SLOT,
  );
  const slotRows: string[] = [
    ...PLANNING_TIME_SLOTS,
    ...extraSlots,
    ...(hasUntimed ? [NO_TIME_SLOT] : []),
  ];

  const conflictMap = planningConflictMap(planning);
  const clashingSessions = weekSessions.filter(
    (entry) => (conflictMap.get(entry.id)?.length ?? 0) > 0,
  );

  const editingEntry = dialog?.editingId
    ? (branchSessions.find((entry) => entry.id === dialog.editingId) ?? null)
    : null;

  // The class select offers the branch itself. A session stored with another
  // label (legacy or a group-style class) keeps that label as an extra option,
  // so opening and saving it cannot silently re-scope the session.
  const formClasses: PlanningClassOption[] = branchLabel
    ? [
        {
          label: branchLabel,
          programId: branch.programId || undefined,
          trainingId: branch.trainingId,
        },
      ]
    : [];
  const extraClassLabel = editingEntry?.className?.trim();
  if (
    extraClassLabel &&
    !formClasses.some((option) => option.label === extraClassLabel)
  ) {
    formClasses.push({
      label: extraClassLabel,
      programId: editingEntry?.programId,
      trainingId: editingEntry?.trainingId,
    });
  }

  const branchTeacherIds = [
    ...new Set(branchSessions.map((entry) => entry.teacherId)),
  ];
  const defaultTeacherId =
    branchTeacherIds.length === 1 ? branchTeacherIds[0] : undefined;

  const todayKey = dateKeyOf(new Date());
  const defaultDate = weekKeySet.has(todayKey) ? todayKey : weekKeys[0];

  const openNew = (date: string, slot?: string) => {
    if (examMode) {
      setExamDialog({ date, slot: slot ?? undefined });
      return;
    }
    if (pfeMode) {
      setPfeDialog({ date, slot: slot ?? undefined });
      return;
    }
    setDraft(null);
    setDialog({ date, slot });
  };

  const openEdit = (entry: PlanningRecord) => {
    if (pfeMode) {
      setPfeDialog({
        date: entry.date?.slice(0, 10) ?? defaultDate,
        editingId: entry.id,
      });
      return;
    }
    setDraft(null);
    setDialog({
      date: entry.date?.slice(0, 10) ?? defaultDate,
      editingId: entry.id,
    });
  };

  // The PFE dialog can re-scope a session to any class this branch already
  // uses; the branch itself is the first option (and the default).
  const pfeClassByLabel = new Map<string, PlanningClassOption>();
  // `branchName` always has a value (it falls back to the training name), so
  // the dialog's class select is never empty on a branch with no program code.
  pfeClassByLabel.set(branchName, {
    label: branchName,
    programId: branch.programId || undefined,
    trainingId: branch.trainingId,
  });
  for (const entry of branchSessions) {
    const label = entry.className?.trim();
    if (label && !pfeClassByLabel.has(label)) {
      pfeClassByLabel.set(label, {
        label,
        programId: entry.programId,
        trainingId: entry.trainingId,
      });
    }
  }
  const pfeClassOptions = [...pfeClassByLabel.values()];
  const pfeEntry = pfeDialog?.editingId
    ? (branchSessions.find((entry) => entry.id === pfeDialog.editingId) ??
      null)
    : null;

  // Live clash check for the dialog: the draft comes from the shared form, so
  // the warning appears while the admin is still choosing.
  const dialogConflicts = dialog
    ? findPlanningConflicts(
        planning,
        {
          date: dialog.date,
          teacherId: draft?.teacherId,
          roomName: draft?.roomName,
          sessionType: draft?.sessionType,
          className: draft?.className,
          sessionTime: draft?.sessionTime,
        },
        dialog.editingId,
      )
    : [];

  const saveEntry = async (values: PlanningEntryValues) => {
    if (!dialog) return;
    if (!dialog.date) {
      setError(t("Pick a date for this session before saving."));
      return;
    }
    try {
      setError(null);
      if (dialog.editingId) {
        await updatePlanning(dialog.editingId, {
          ...values,
          date: dialog.date,
        });
      } else {
        if (!values.teacherId) return;
        await insertPlanning({
          ...values,
          id: crypto.randomUUID(),
          teacherId: values.teacherId,
          date: dialog.date,
        });
      }
      await onReload();
      setDialog(null);
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
      setDialog(null);
    }
  };

  const removeEntry = async (entry: PlanningRecord) => {
    try {
      setError(null);
      await deletePlanning(entry.id);
      await onReload();
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  const describeConflict = (conflict: PlanningConflict): string => {
    const other = conflict.other;
    const subject = other.course || other.content || t("another session");
    const window = other.sessionTime ? ` (${other.sessionTime})` : "";
    if (conflict.kind === "teacher") {
      const name = teacherById.get(other.teacherId) ?? t("This teacher");
      return t("{name} already teaches “{subject}”{window}.", {
        name,
        subject,
        window,
      });
    }
    if (conflict.kind === "room") {
      return t("Room {room} is already used by “{subject}”{window}.", {
        room: other.roomName ?? "—",
        subject,
        window,
      });
    }
    return t("Class {class} already has “{subject}”{window}.", {
      class: other.className ?? "—",
      subject,
      window,
    });
  };

  const conflictMessages = [
    ...new Set(dialogConflicts.map(describeConflict)),
  ];

  return (
    <div id="planning-print-area">
      <Button
        variant="ghost"
        size="sm"
        className="planning-no-print -ml-2"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel ?? t("Back to Branches")}
      </Button>

      <h2 className="mt-2 text-2xl font-semibold text-foreground">
        {branchName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {examMode
          ? t("Exam schedule — add or edit this branch’s exam sittings.")
          : pfeMode
            ? t("PFE schedule — defences, internships and their jury panels.")
            : t(
                "Weekly timetable — add, move or remove this branch’s sessions.",
              )}
      </p>
      {/* The week navigator is screen-only, so the printed sheet names the
          week itself. */}
      <p className="hidden text-xs text-muted-foreground print:block">
        {formatWeekRange(cursor)} · {weekSessions.length}{" "}
        {weekSessions.length === 1 ? t("session") : t("sessions")}
      </p>

      <div className="planning-no-print mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("Previous week")}
            onClick={() => setCursor((current) => addDays(current, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {formatWeekRange(cursor)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("Next week")}
            onClick={() => setCursor((current) => addDays(current, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfWeek(new Date()))}
          >
            {t("This week")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={classFilter}
            items={classFilterItems}
            onValueChange={(value) => setClassFilter(value ?? ALL_CLASSES)}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("Filter by class")}
              className="h-8 w-56 border-zinc-200 bg-zinc-100/80 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <SelectValue placeholder={t("All classes")} />
            </SelectTrigger>
            <SelectContent>
              {classFilterItems.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {weekSessions.length}{" "}
            {weekSessions.length === 1 ? t("session") : t("sessions")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title={t("Print this week or save it as a PDF")}
          >
            <Printer className="h-4 w-4" />
            {t("Print / PDF")}
          </Button>
          <Button size="sm" onClick={() => openNew(defaultDate)}>
            <Plus className="h-4 w-4" />
            {t("Add session")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {clashingSessions.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <span className="font-medium">
              {clashingSessions.length === 1
                ? t("{count} session clashes", {
                    count: clashingSessions.length,
                  })
                : t("{count} sessions clash", {
                    count: clashingSessions.length,
                  })}
            </span>{" "}
            {t(
              "with another session this week — a teacher, room or class is double-booked. Flagged cards carry a warning icon.",
            )}
          </p>
        </div>
      )}

      {weekSessions.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium">
              {t("No sessions planned for this branch this week.")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("Use the + in any slot below, or add a session to another week.")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="planning-no-print"
            onClick={() => openNew(defaultDate)}
          >
            <Plus className="h-4 w-4" />
            {t("Add first session")}
          </Button>
        </div>
      ) : null}

      <div className="planning-grid-shell mt-4 -mx-4 overflow-x-auto rounded-lg border border-border bg-card px-4 sm:mx-0 sm:px-0">
        <div
          className="planning-grid grid min-w-[900px]"
          style={{
            gridTemplateColumns: `72px repeat(${dayColumns.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="border-r border-b border-border bg-muted/40 p-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("Time")}
          </div>
          {dayColumns.map((day, index) => {
            const isToday = day.key === todayKey;
            return (
              <div
                key={day.key}
                className={cn(
                  "border-r border-b border-border bg-muted/40 p-2 text-center last:border-r-0",
                  isToday && "bg-accent/60",
                )}
              >
                <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">
                  {t(WEEKDAY_LABELS[index])}
                </span>
                <span className="text-sm font-semibold">{day.date.getDate()}</span>
              </div>
            );
          })}

          {slotRows.map((slot) => (
            <Fragment key={slot}>
              <div className="border-r border-b border-border p-2 text-[11px] font-medium text-muted-foreground">
                {slot}
              </div>
              {dayColumns.map((day) => {
                const cellSessions = weekSessions.filter(
                  (entry) =>
                    entry.date?.slice(0, 10) === day.key &&
                    planningSlotKey(entry.sessionTime) === slot,
                );
                return (
                  <div
                    key={`${day.key}:${slot}`}
                    className="group min-h-24 border-r border-b border-border p-1.5 transition-colors last:border-r-0 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex flex-col gap-1.5">
                      {cellSessions.map((entry) => {
                        const entryConflicts = conflictMap.get(entry.id) ?? [];
                        const tone = subjectTone(entry.course);
                        // PFE cards show the whole panel; every other session
                        // keeps its single assigned teacher.
                        const juryNames = (entry.juryTeacherIds ?? [])
                          .map((id) => teacherById.get(id))
                          .filter((name): name is string => Boolean(name));
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEdit(entry)}
                            title={t("Edit {name}", {
                              name: entry.course || entry.sessionType,
                            })}
                            className={cn(
                              "w-full rounded-md border border-l-4 p-1.5 text-left transition-colors hover:bg-zinc-100/70 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:hover:bg-white/10 dark:focus-visible:ring-zinc-500",
                              tone.border,
                              tone.bg,
                            )}
                          >
                            <span className="flex items-start justify-between gap-1">
                              <span className="truncate text-[11px] font-semibold">
                                {entry.course || entry.sessionType}
                              </span>
                              {entryConflicts.length > 0 ? (
                                <TriangleAlert
                                  className="h-3.5 w-3.5 shrink-0 text-amber-600"
                                  aria-label={t(
                                    "This session clashes with another one",
                                  )}
                                />
                              ) : null}
                            </span>
                            {juryNames.length > 0 ? (
                              <span className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground">
                                <UsersRound className="mt-0.5 h-3 w-3 shrink-0" />
                                <span
                                  className="line-clamp-2"
                                  title={juryNames.join(", ")}
                                >
                                  {t("Jury")}: {juryNames.join(", ")}
                                </span>
                              </span>
                            ) : (
                              <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <UserRound className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {teacherById.get(entry.teacherId) ??
                                    t("Unknown teacher")}
                                </span>
                              </span>
                            )}
                            {entry.className && entry.className !== branchLabel ? (
                              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                {entry.className}
                              </span>
                            ) : null}
                            <span className="mt-1.5 flex flex-wrap items-center gap-1">
                              <PlanningLocationBadge
                                room={entry.roomName}
                                sessionType={entry.sessionType}
                              />
                              <PlanningSessionTypeBadge
                                sessionType={entry.sessionType}
                                label={entry.customSessionType}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("Add a session on {date} at {slot}", {
                        date: formatLongDate(day.key),
                        slot,
                      })}
                      className="planning-no-print mt-1 h-6 w-full text-zinc-400 opacity-60 transition-opacity hover:text-zinc-900 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-white"
                      onClick={() =>
                        openNew(day.key, slot === NO_TIME_SLOT ? undefined : slot)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {examDialog ? (
        <AddExamSessionModal
          branchLabel={branchName}
          branchProgramId={branch.programId || undefined}
          branchTrainingId={branch.trainingId}
          initialDate={examDialog.date}
          initialSlot={examDialog.slot}
          teachers={teachers}
          onClose={() => setExamDialog(null)}
          onSaved={onReload}
        />
      ) : null}

      {pfeDialog && (!pfeDialog.editingId || pfeEntry) ? (
        <AddPFESessionModal
          branchLabel={branchName}
          branchProgramId={branch.programId || undefined}
          branchTrainingId={branch.trainingId}
          classes={pfeClassOptions}
          initialDate={pfeDialog.date}
          initialSlot={pfeDialog.slot}
          entry={pfeEntry}
          teachers={teachers}
          onClose={() => setPfeDialog(null)}
          onSaved={onReload}
          onDelete={
            pfeEntry
              ? () => {
                  setDeleteTarget(pfeEntry);
                  setPfeDialog(null);
                }
              : undefined
          }
        />
      ) : null}

      {dialog ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null);
              setDraft(null);
            }
          }}
        >
          {/* Landscape session dialog: the form lays its fields out in three
              columns, so the popup has to be wide (and scroll on short
              screens) instead of the default narrow dialog. */}
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl sm:p-6 lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {dialog.editingId ? t("Edit session") : t("New session")}
              </DialogTitle>
              <DialogDescription>
                {branchName} · {formatLongDate(dialog.date)}
                {dialog.slot ? ` · ${dialog.slot}` : ""}
              </DialogDescription>
            </DialogHeader>

            {conflictMessages.length > 0 ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold">
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                  {t("Conflict warning")}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {conflictMessages.slice(0, 4).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {conflictMessages.length > 4 ? (
                  <p className="mt-1 text-muted-foreground">
                    {t("+{count} more", {
                      count: conflictMessages.length - 4,
                    })}
                    .
                  </p>
                ) : null}
                <p className="mt-1 text-muted-foreground">
                  {t("You can still save — this is a warning, not a block.")}
                </p>
              </div>
            ) : null}

            {/* The day is edited inside the form now, so it is not part of the
                key: changing it must not wipe what was already typed. */}
            <PlanningEntryForm
              key={dialog.editingId ?? "new"}
              initial={editingEntry ?? undefined}
              defaultTeacherId={defaultTeacherId}
              defaultSessionTime={dialog.slot}
              requireContent={false}
              teacherOptions={teachers.map((teacher) => ({
                id: teacher.id,
                label: teacher.fullName,
              }))}
              teacherQualifier={(subject) =>
                qualifiedTeacherIds(subject, {
                  courses,
                  teachers,
                  trainingId: branch.trainingId,
                })
              }
              // The branch is the class: the modal cannot re-scope a session to
              // another track from here.
              lockClass
              subjects={PLANNING_SUBJECTS}
              timeSlots={PLANNING_TIME_SLOTS}
              showNotes
              layout="grid"
              date={dialog.date}
              onDateChange={(next) =>
                setDialog((current) =>
                  current ? { ...current, date: next } : current,
                )
              }
              courses={[]}
              classes={formClasses}
              submitLabel={
                dialog.editingId ? t("Save Changes") : t("Add Session")
              }
              showCancel={Boolean(dialog.editingId)}
              onDraftChange={setDraft}
              onSubmit={(values) => void saveEntry(values)}
              onCancel={() => {
                setDialog(null);
                setDraft(null);
              }}
            />

            {editingEntry ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive"
                onClick={() => {
                  setDeleteTarget(editingEntry);
                  setDialog(null);
                  setDraft(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t("Delete session")}
              </Button>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete session?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "This permanently removes {name} on {date} from the {branch} timetable.",
                {
                  name: deleteTarget?.course
                    ? `“${deleteTarget.course}”`
                    : t("this session"),
                  date: formatLongDate(deleteTarget?.date),
                  branch: branchName,
                },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void removeEntry(deleteTarget);
              }}
            >
              {t("Delete Session")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {t("Sessions without a time window are grouped in the last row.")}
      </p>
    </div>
  );
}
