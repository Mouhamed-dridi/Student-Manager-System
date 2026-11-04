// Operator "Planification" — step 2: one teacher's weekly schedule for one
// training, opened from a training card on the main overview.
//
// The whole app keeps sections in state instead of routes (see AGENTS.md), so
// this replaces the section content and registers itself on the shared history
// stack: the header arrow and "< Back to Planification" do the same thing.
//
// Sessions are scoped to the teacher AND the training. Each card exposes the
// classroom as an inline dropdown that writes `planning.room_name` straight
// away; the pencil opens the shared entry form for everything else.

import { useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
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
import { PlanningSessionTypeBadge } from "@/components/PlanningSessionTypeBadge";
import { useNestedView } from "@/hooks/viewHistory";
import {
  deletePlanning,
  errorMessage,
  insertPlanning,
  updatePlanning,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  addDays,
  dateKeyOf,
  formatLongDate,
  formatWeekRange,
  startOfWeek,
  WEEKDAY_LABELS,
} from "@/pages/student-portal/scheduleDates";
import {
  DEFAULT_PLANNING_CLASSROOM,
  PLANNING_CLASSROOMS,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningClassOption,
  PlanningEntryValues,
  PlanningRecord,
} from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { sessionInTraining } from "./tracks";

interface AdminTeacherPlanningDetailProps {
  teacher: Teacher;
  training: { id: string; name: string; programCode: string };
  /** Every planning row the main overview already loaded (all teachers). */
  planning: PlanningRecord[];
  /** Full roster, so a session can be reassigned to another teacher. */
  teachers: Teacher[];
  classOptions: PlanningClassOption[];
  courseNames: string[];
  onBack: () => void;
  /** Reload the overview after a write so the two views cannot drift. */
  onChanged: () => Promise<void>;
}

function sessionTimeValue(entry: PlanningRecord): string {
  return entry.sessionTime ?? "99:99";
}

/** The fixed classroom list, plus whatever an older row already stores. */
function roomOptionsFor(current?: string): string[] {
  const value = current?.trim() ?? "";
  return value && !(PLANNING_CLASSROOMS as readonly string[]).includes(value)
    ? [value, ...PLANNING_CLASSROOMS]
    : [...PLANNING_CLASSROOMS];
}

export default function AdminTeacherPlanningDetail({
  teacher,
  training,
  planning,
  teachers,
  classOptions,
  courseNames,
  onBack,
  onChanged,
}: AdminTeacherPlanningDetailProps) {
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [dialog, setDialog] = useState<{
    date: string;
    editingId?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanningRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nested view on the shared stack: the header arrow closes exactly like the
  // page's own Back button.
  useNestedView(true, "planification-teacher", "Teacher schedule", onBack);

  // Only this teacher's sessions for this training: the card the admin clicked
  // is the teacher/training pair, so the grid must not mix another track in.
  const scopedEntries = planning.filter(
    (entry) =>
      entry.teacherId === teacher.id && sessionInTraining(entry, training),
  );

  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(cursor, index),
  );
  const weekKeys = weekDays.map(dateKeyOf);
  const weekKeySet = new Set(weekKeys);
  const weekEntries = scopedEntries
    .filter((entry) => weekKeySet.has(entry.date))
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      sessionTimeValue(a).localeCompare(sessionTimeValue(b)),
    );

  const byDate = new Map<string, PlanningRecord[]>();
  for (const entry of weekEntries) {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }

  const editingEntry = dialog?.editingId
    ? (scopedEntries.find((entry) => entry.id === dialog.editingId) ?? null)
    : null;

  const todayKey = dateKeyOf(new Date());
  const addDate = weekKeySet.has(todayKey) ? todayKey : weekKeys[0];

  // New entries inherit this teacher + training, so they land straight back in
  // the grid the admin is looking at.
  const trainingClasses = classOptions.filter(
    (option) => option.trainingId === training.id,
  );
  const formClasses = trainingClasses.length > 0 ? trainingClasses : classOptions;

  const saveEntry = async (
    values: PlanningEntryValues,
    editingId: string | null,
    date: string,
  ) => {
    try {
      setError(null);
      if (editingId) {
        await updatePlanning(editingId, values);
      } else {
        await insertPlanning({
          ...values,
          id: crypto.randomUUID(),
          teacherId: values.teacherId || teacher.id,
          date,
        });
      }
      await onChanged();
      setDialog(null);
    } catch (err) {
      setError(errorMessage(err));
      setDialog(null);
    }
  };

  const changeRoom = async (entry: PlanningRecord, roomName: string) => {
    if (entry.roomName === roomName) return;
    try {
      setError(null);
      // The update replaces the editable fields, so the untouched ones are
      // echoed back rather than cleared.
      await updatePlanning(entry.id, {
        course: entry.course,
        sessionType: entry.sessionType,
        className: entry.className,
        programId: entry.programId,
        trainingId: entry.trainingId,
        sessionTime: entry.sessionTime,
        roomName,
        content: entry.content,
      });
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeEntry = async (entry: PlanningRecord) => {
    try {
      setError(null);
      await deletePlanning(entry.id);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  const trainingLabel = [training.programCode, training.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Back to Planification
      </Button>

      <h2 className="mt-2 text-2xl font-semibold">{teacher.fullName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {trainingLabel || training.name} · weekly schedule — add, edit or
        reassign this training&apos;s sessions.
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {weekEntries.length}{" "}
            {weekEntries.length === 1 ? "session" : "sessions"}
          </span>
          <Button size="sm" onClick={() => setDialog({ date: addDate })}>
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const key = weekKeys[index];
          const dayEntries = byDate.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-56 flex-col items-stretch gap-1.5 rounded-md border p-2",
                key === todayKey && "border-foreground/40",
              )}
            >
              <span className="flex items-start justify-between gap-1 pb-1">
                <span className="text-center">
                  <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">
                    {WEEKDAY_LABELS[index]}
                  </span>
                  <span className="text-base font-semibold">
                    {day.getDate()}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Add a session on ${formatLongDate(key)}`}
                  onClick={() => setDialog({ date: key })}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </span>

              {dayEntries.length === 0 ? (
                <span className="py-6 text-center text-[10px] text-muted-foreground">
                  No sessions
                </span>
              ) : (
                dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded bg-accent px-1.5 py-1.5 text-accent-foreground"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {entry.sessionTime ?? "Anytime"}
                        </span>
                      </span>
                      <PlanningSessionTypeBadge
                        sessionType={entry.sessionType}
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium">
                      {entry.content || "No topic"}
                    </p>
                    {entry.course ? (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {entry.course}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-1">
                      <Select
                        value={entry.roomName ?? DEFAULT_PLANNING_CLASSROOM}
                        onValueChange={(value) => {
                          if (value) void changeRoom(entry, value);
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={`Classroom for ${entry.content || "this session"}`}
                          className="h-6 min-w-0 flex-1 rounded px-1.5 text-[10px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roomOptionsFor(entry.roomName).map((room) => (
                            <SelectItem key={room} value={room}>
                              {room}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit session ${entry.course ?? entry.content}`.trim()}
                        onClick={() =>
                          setDialog({ date: entry.date, editingId: entry.id })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete session ${entry.course ?? entry.content}`.trim()}
                        onClick={() => setDeleteTarget(entry)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {dialog ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog.editingId ? "Edit session" : "New session"}
              </DialogTitle>
              <DialogDescription>
                {formatLongDate(dialog.date)} · {trainingLabel || training.name}
              </DialogDescription>
            </DialogHeader>
            <PlanningEntryForm
              key={dialog.editingId ?? "new"}
              initial={editingEntry ?? undefined}
              defaultTeacherId={teacher.id}
              teacherOptions={teachers.map((option) => ({
                id: option.id,
                label: option.fullName,
              }))}
              courses={courseNames}
              classes={formClasses}
              submitLabel={dialog.editingId ? "Save Changes" : "Add Entry"}
              showCancel={Boolean(dialog.editingId)}
              onSubmit={(values) =>
                saveEntry(values, dialog.editingId ?? null, dialog.date)
              }
              onCancel={() => setDialog(null)}
            />
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
              This permanently removes the session of {deleteTarget?.date}
              {deleteTarget?.course ? ` for “${deleteTarget.course}”` : ""} from{" "}
              {teacher.fullName}&apos;s planning.
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
    </div>
  );
}
