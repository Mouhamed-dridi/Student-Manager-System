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
// Reads and writes go through src/lib/api, like every other page.

import { Fragment, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  TriangleAlert,
  UserRound,
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
import type { PlanningEntryDraft } from "@/components/PlanningEntryForm";
import { PlanningRoomBadge } from "@/components/PlanningRoomBadge";
import { PlanningSessionTypeBadge } from "@/components/PlanningSessionTypeBadge";
import { useNestedView } from "@/hooks/viewHistory";
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
  backLabel = "Back to Branches",
  onBack,
  onReload,
}: BranchPlanningPageProps) {
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
  const [deleteTarget, setDeleteTarget] = useState<PlanningRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useNestedView(true, "branch-planning", "Branch timetable", onBack);

  const teacherById = new Map(
    teachers.map((teacher) => [teacher.id, teacher.fullName]),
  );

  const branchLabel = classNameFor(branch.programCode, branch.name);
  const branchName = branchLabel || branch.name;

  const branchSessions = planning
    .filter((entry) => sessionInTraining(entry, branch))
    .sort((a, b) => b.date.localeCompare(a.date));

  const classOptionsForFilter = [
    ...new Set(
      branchSessions
        .map((entry) => entry.className?.trim())
        .filter((label): label is string => Boolean(label)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const hasUnclassed = branchSessions.some((entry) => !entry.className?.trim());

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
          trainingId: branch.id,
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
    setDraft(null);
    setDialog({ date, slot });
  };

  const openEdit = (entry: PlanningRecord) => {
    setDraft(null);
    setDialog({
      date: entry.date?.slice(0, 10) ?? defaultDate,
      editingId: entry.id,
    });
  };

  // Live clash check for the dialog: the draft comes from the shared form, so
  // the warning appears while the admin is still choosing.
  const dialogConflicts = dialog
    ? findPlanningConflicts(
        planning,
        {
          date: dialog.date,
          teacherId: draft?.teacherId,
          roomName: draft?.roomName,
          className: draft?.className,
          sessionTime: draft?.sessionTime,
        },
        dialog.editingId,
      )
    : [];

  const saveEntry = async (values: PlanningEntryValues) => {
    if (!dialog) return;
    if (!dialog.date) {
      setError("Pick a date for this session before saving.");
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
    const subject = other.course || other.content || "another session";
    const window = other.sessionTime ? ` (${other.sessionTime})` : "";
    if (conflict.kind === "teacher") {
      const name = teacherById.get(other.teacherId) ?? "This teacher";
      return `${name} already teaches “${subject}”${window}.`;
    }
    if (conflict.kind === "room") {
      return `Room ${other.roomName} is already used by “${subject}”${window}.`;
    }
    return `Class ${other.className} already has “${subject}”${window}.`;
  };

  const conflictMessages = [
    ...new Set(dialogConflicts.map(describeConflict)),
  ];

  return (
    <div>
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>

      <h2 className="mt-2 text-2xl font-semibold">{branchName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Weekly timetable — add, move or remove this branch&apos;s sessions.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setCursor((current) => addDays(current, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">
            {formatWeekRange(cursor)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setCursor((current) => addDays(current, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfWeek(new Date()))}
          >
            This week
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={classFilter}
            onValueChange={(value) => setClassFilter(value ?? ALL_CLASSES)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Filter by class"
              className="w-56"
            >
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
              {classOptionsForFilter.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
              {hasUnclassed ? (
                <SelectItem value={NO_CLASS}>No class</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {weekSessions.length}{" "}
            {weekSessions.length === 1 ? "session" : "sessions"}
          </span>
          <Button size="sm" onClick={() => openNew(defaultDate)}>
            <Plus className="h-4 w-4" />
            Add session
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
              {clashingSessions.length}{" "}
              {clashingSessions.length === 1 ? "session clashes" : "sessions clash"}
            </span>{" "}
            with another session this week — a teacher, room or class is
            double-booked. Flagged cards carry a warning icon.
          </p>
        </div>
      )}

      {weekSessions.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <div>
            <p className="text-sm font-medium">
              No sessions planned for this branch this week.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Use the + in any slot below, or add a session to another week.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openNew(defaultDate)}>
            <Plus className="h-4 w-4" />
            Add first session
          </Button>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <div
          className="grid min-w-[900px]"
          style={{
            gridTemplateColumns: `72px repeat(${dayColumns.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="border-r border-b bg-muted/40 p-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Time
          </div>
          {dayColumns.map((day, index) => {
            const isToday = day.key === todayKey;
            return (
              <div
                key={day.key}
                className={cn(
                  "border-r border-b bg-muted/40 p-2 text-center last:border-r-0",
                  isToday && "bg-accent/60",
                )}
              >
                <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">
                  {WEEKDAY_LABELS[index]}
                </span>
                <span className="text-sm font-semibold">{day.date.getDate()}</span>
              </div>
            );
          })}

          {slotRows.map((slot) => (
            <Fragment key={slot}>
              <div className="border-r border-b p-2 text-[11px] font-medium text-muted-foreground">
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
                    className="group min-h-24 border-r border-b p-1.5 last:border-r-0"
                  >
                    <div className="flex flex-col gap-1.5">
                      {cellSessions.map((entry) => {
                        const entryConflicts = conflictMap.get(entry.id) ?? [];
                        const tone = subjectTone(entry.course);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEdit(entry)}
                            title={`Edit ${entry.course || "session"}`}
                            className={cn(
                              "w-full rounded-md border border-l-4 p-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                              tone.border,
                              tone.bg,
                            )}
                          >
                            <span className="flex items-start justify-between gap-1">
                              <span className="truncate text-[11px] font-semibold">
                                {entry.course || "Session"}
                              </span>
                              {entryConflicts.length > 0 ? (
                                <TriangleAlert
                                  className="h-3.5 w-3.5 shrink-0 text-amber-600"
                                  aria-label="This session clashes with another one"
                                />
                              ) : null}
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <UserRound className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {teacherById.get(entry.teacherId) ??
                                  "Unknown teacher"}
                              </span>
                            </span>
                            {entry.className && entry.className !== branchLabel ? (
                              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                {entry.className}
                              </span>
                            ) : null}
                            <span className="mt-1.5 flex flex-wrap items-center gap-1">
                              {entry.roomName ? (
                                <PlanningRoomBadge room={entry.roomName} />
                              ) : null}
                              <PlanningSessionTypeBadge
                                sessionType={entry.sessionType}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Add a session on ${formatLongDate(day.key)} at ${slot}`}
                      className="mt-1 h-6 w-full opacity-40 transition-opacity group-hover:opacity-100"
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
                {dialog.editingId ? "Edit session" : "New session"}
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
                  Conflict warning
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {conflictMessages.slice(0, 4).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {conflictMessages.length > 4 ? (
                  <p className="mt-1 text-muted-foreground">
                    +{conflictMessages.length - 4} more.
                  </p>
                ) : null}
                <p className="mt-1 text-muted-foreground">
                  You can still save — this is a warning, not a block.
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
                  trainingId: branch.id,
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
              submitLabel={dialog.editingId ? "Save Changes" : "Add Session"}
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
                Delete session
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
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              {deleteTarget?.course
                ? `“${deleteTarget.course}”`
                : "this session"}{" "}
              on {formatLongDate(deleteTarget?.date)} from the{" "}
              {branchName} timetable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void removeEntry(deleteTarget);
              }}
            >
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Sessions without a time window are grouped in the last row.
      </p>
    </div>
  );
}
