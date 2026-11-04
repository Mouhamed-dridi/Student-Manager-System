import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  DEFAULT_PLANNING_CLASSROOM,
  isPlanningSessionType,
  planningSlotKey,
  PLANNING_CLASSROOMS,
  PLANNING_SESSION_TYPES,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningClassOption,
  PlanningEntryValues,
  PlanningRecord,
  PlanningSessionType,
} from "@/pages/teacher-portal/planning";

// Shared by the teacher Planning page, the operator Planification editor and
// the operator branch timetable, so the writes cannot drift apart. The teacher
// portal renders it without `teacherOptions` (an entry always belongs to the
// signed-in teacher); the operator passes them to choose the teacher.
//
// The branch timetable (`BranchPlanningPage`) opts into the class-based
// behaviour: `lockClass`, a fixed `subjects` list, `teacherQualifier` so the
// teacher picker follows the subject, `timeSlots` for a preset window select
// and `showNotes` for the internal comment. It also asks for `layout="grid"`,
// the landscape form (date | class | subject / teacher | type | room / time |
// topic / notes) — the teacher dialogs stay narrow, so they keep the stack.

const NO_CLASS = "__none";
const CUSTOM_TIME = "__custom";

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

/** The live form state, reported so a caller can check for timetable clashes. */
export interface PlanningEntryDraft {
  teacherId?: string;
  className?: string;
  roomName?: string;
  sessionTime?: string;
}

/**
 * `stack` is the original single column used by the teacher dialogs; `grid` is
 * the landscape form for the operator's wide session dialog.
 */
export type PlanningEntryLayout = "stack" | "grid";

export interface PlanningEntryFormProps {
  initial?: PlanningRecord;
  courses: string[];
  classes: PlanningClassOption[];
  submitLabel: string;
  showCancel: boolean;
  onSubmit: (values: PlanningEntryValues) => void;
  onCancel: () => void;
  /** Operator only: lets a session be reassigned to another teacher. */
  teacherOptions?: { id: string; label: string }[];
  /** Teacher pre-selected for a new entry (operator only). */
  defaultTeacherId?: string;
  /** Timetable slot to prefill when adding a session (operator branch view). */
  defaultSessionTime?: string;
  /** Timetables do not always have a topic; the teacher page still requires one. */
  requireContent?: boolean;
  /** Reports the draft on every change (operator timetable conflict checks). */
  onDraftChange?: (draft: PlanningEntryDraft) => void;
  /**
   * Fixed subject list. When set, it replaces the course catalog for the
   * `course` field (the subject is what a branch timetable schedules).
   */
  subjects?: readonly string[];
  /**
   * Teacher ids qualified for the chosen subject. Only ever narrows the
   * teacher picker: an empty result shows every teacher instead.
   */
  teacherQualifier?: (subject: string) => string[];
  /** The class is fixed by the branch, so it is shown read-only. */
  lockClass?: boolean;
  /** Preset windows for the time select; "Custom times" keeps free entry. */
  timeSlots?: readonly string[];
  /** Operator-only internal note (`planning.notes`). */
  showNotes?: boolean;
  /**
   * The session's day, edited inside the form. Only the branch timetable
   * passes it (changing it there is how a session is moved).
   */
  date?: string;
  onDateChange?: (date: string) => void;
  /** Landscape grid when the dialog is wide enough, single column otherwise. */
  layout?: PlanningEntryLayout;
}

export default function PlanningEntryForm({
  initial,
  courses,
  classes,
  submitLabel,
  showCancel,
  onSubmit,
  onCancel,
  teacherOptions,
  defaultTeacherId,
  defaultSessionTime,
  requireContent = true,
  onDraftChange,
  subjects,
  teacherQualifier,
  lockClass = false,
  timeSlots,
  showNotes = false,
  date,
  onDateChange,
  layout = "stack",
}: PlanningEntryFormProps) {
  const [teacherId, setTeacherId] = useState(
    initial?.teacherId ?? defaultTeacherId ?? "",
  );
  const [course, setCourse] = useState(initial?.course ?? "");
  const [sessionType, setSessionType] = useState<PlanningSessionType>(
    initial?.sessionType ?? "In-class",
  );
  // A teacher with a single assigned class gets it prefilled; otherwise the
  // field stays blank until they pick one.
  const [className, setClassName] = useState(
    initial?.className ?? (classes.length === 1 ? classes[0].label : ""),
  );
  const initialTime = parseSessionTime(
    initial?.sessionTime ?? defaultSessionTime,
  );
  const [startTime, setStartTime] = useState(initialTime.start);
  const [endTime, setEndTime] = useState(initialTime.end);
  const [slotValue, setSlotValue] = useState(() => {
    if (!timeSlots || timeSlots.length === 0) return CUSTOM_TIME;
    const current = formatSessionTime(initialTime.start, initialTime.end);
    return (
      timeSlots.find((slot) => planningSlotKey(slot) === planningSlotKey(current)) ??
      CUSTOM_TIME
    );
  });
  const [roomName, setRoomName] = useState(
    initial?.roomName?.trim() || DEFAULT_PLANNING_CLASSROOM,
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // A room stored before the list was fixed (or typed by hand) stays
  // selectable, so editing an old entry never silently moves it.
  const roomOptions: string[] =
    roomName && !(PLANNING_CLASSROOMS as readonly string[]).includes(roomName)
      ? [roomName, ...PLANNING_CLASSROOMS]
      : [...PLANNING_CLASSROOMS];

  // Same idea for the subject: a legacy free-text course stays selectable so
  // opening and saving a session cannot blank it.
  const subjectOptions: string[] = [...(subjects ?? courses)];
  if (course && !subjectOptions.includes(course)) subjectOptions.unshift(course);

  // Subject → teacher: keep the current pick even when it is not linked to the
  // new subject, and never narrow to nothing (the admin may know better).
  const qualifiedIds =
    teacherQualifier && course ? teacherQualifier(course) : [];
  const effectiveTeacherOptions = teacherOptions
    ? qualifiedIds.length > 0
      ? teacherOptions.filter(
          (option) =>
            qualifiedIds.includes(option.id) || option.id === teacherId,
        )
      : teacherOptions
    : undefined;
  const linkedTeacherCount = effectiveTeacherOptions
    ? effectiveTeacherOptions.filter((option) => qualifiedIds.includes(option.id))
        .length
    : 0;

  const timeInvalid = Boolean(startTime && endTime && endTime < startTime);
  const teacherMissing = Boolean(teacherOptions && !teacherId);
  const contentMissing = requireContent && content.trim() === "";
  const valid = !contentMissing && !timeInvalid && !teacherMissing;

  const isGrid = layout === "grid";
  // In the grid, every cell is a column of its own; `space-y-1.5` keeps the
  // label, control and hint tight enough for three rows to fit a landscape
  // dialog without scrolling.
  const fieldClass = isGrid ? "min-w-0 space-y-1.5" : "space-y-2";

  // Optional: the operator branch timetable watches the draft to warn about
  // an overlapping teacher, room or class before the session is saved.
  useEffect(() => {
    onDraftChange?.({
      teacherId: teacherId || undefined,
      className: className || undefined,
      roomName: roomName || undefined,
      sessionTime: formatSessionTime(startTime, endTime),
    });
  }, [teacherId, className, roomName, startTime, endTime, onDraftChange]);

  return (
    <div className={isGrid ? "space-y-3" : "space-y-4"}>
      <div
        className={
          isGrid
            ? "grid grid-cols-1 items-start gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-3"
            : "space-y-4"
        }
      >
        {onDateChange ? (
          <div className={fieldClass}>
            <Label htmlFor="log-date">Date</Label>
            <Input
              id="log-date"
              type="date"
              value={date ?? ""}
              onChange={(event) => onDateChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Changing the date moves the session.
            </p>
          </div>
        ) : null}

        {lockClass ? (
          <div className={fieldClass}>
            <Label>Class / Branch</Label>
            <div className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 text-sm">
              <span className="truncate">{className || "No class"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Fixed by the branch this timetable belongs to.
            </p>
          </div>
        ) : (
          <div className={fieldClass}>
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
                  <SelectItem key={c.label} value={c.label}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={fieldClass}>
          <Label>{subjects ? "Subject" : "Course"}</Label>
          <Select value={course} onValueChange={(value) => setCourse(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  subjectOptions.length > 0
                    ? subjects
                      ? "Select subject"
                      : "Select course"
                    : "No courses available"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {effectiveTeacherOptions ? (
          <div className={fieldClass}>
            <Label>Teacher</Label>
            <Select
              value={teacherId}
              onValueChange={(value) => setTeacherId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {effectiveTeacherOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {qualifiedIds.length > 0
                ? `${linkedTeacherCount} ${
                    linkedTeacherCount === 1 ? "teacher is" : "teachers are"
                  } linked to ${course}. Changing this moves the session to that teacher's planning.`
                : teacherQualifier && course
                  ? `No teacher is linked to ${course} yet — showing all teachers.`
                  : "Changing this moves the session to that teacher's planning."}
            </p>
          </div>
        ) : null}

        <div className={fieldClass}>
          <Label>Session Type</Label>
          <Select
            value={sessionType}
            onValueChange={(value) => {
              if (isPlanningSessionType(value)) setSessionType(value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANNING_SESSION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label>Classroom / Room</Label>
          <Select
            value={roomName}
            onValueChange={(value) => setRoomName(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select classroom" />
            </SelectTrigger>
            <SelectContent>
              {roomOptions.map((room) => (
                <SelectItem key={room} value={room}>
                  {room}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Shown as a badge next to the session time in every planning view.
          </p>
        </div>

        <div className={fieldClass}>
          <Label>Time</Label>
          {timeSlots && timeSlots.length > 0 ? (
            <Select
              value={slotValue}
              onValueChange={(value) => {
                const next = value ?? CUSTOM_TIME;
                setSlotValue(next);
                if (next !== CUSTOM_TIME) {
                  const parsed = parseSessionTime(next);
                  setStartTime(parsed.start);
                  setEndTime(parsed.end);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a time slot" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_TIME}>Custom times…</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          {!timeSlots || slotValue === CUSTOM_TIME ? (
            <div className="flex items-center gap-2">
              <Input
                id="log-start-time"
                type="time"
                className="min-w-0 flex-1"
                aria-label="Session start time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                id="log-end-time"
                type="time"
                className="min-w-0 flex-1"
                aria-label="Session end time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          ) : null}
          {timeInvalid ? (
            <p className="text-xs text-destructive">
              End time must be after the start time.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Optional. Pick a slot, or use custom times for any other window.
            </p>
          )}
        </div>

        <div
          className={
            isGrid ? "min-w-0 space-y-1.5 md:col-span-2 lg:col-span-2" : "space-y-2"
          }
        >
          <Label htmlFor="log-content">Topic / course details</Label>
          <Textarea
            id="log-content"
            rows={isGrid ? 3 : undefined}
            placeholder="e.g. Chapter 3: IP Routing Protocols, or Lab 2: React Hooks"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        {showNotes ? (
          <div
            className={
              isGrid
                ? "min-w-0 space-y-1.5 md:col-span-2 lg:col-span-3"
                : "space-y-2"
            }
          >
            <Label htmlFor="log-notes">Comment / internal note</Label>
            <Textarea
              id="log-notes"
              rows={isGrid ? 2 : undefined}
              placeholder="Administrative note, e.g. exam room change or a reminder…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Internal only — students never see this.
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={
          isGrid
            ? "flex flex-wrap items-center justify-end gap-2 border-t pt-3"
            : "flex justify-end gap-2"
        }
      >
        {showCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => {
            const selected = classes.find((c) => c.label === className);
            // Editing an entry whose class is no longer offered keeps its
            // stored scope, but only while the label itself is unchanged.
            const keepsExisting = className === (initial?.className ?? "");
            onSubmit({
              course: course || undefined,
              sessionType,
              className: className || undefined,
              programId:
                selected?.programId ||
                (keepsExisting ? initial?.programId : undefined),
              trainingId:
                selected?.trainingId ||
                (keepsExisting ? initial?.trainingId : undefined),
              sessionTime: formatSessionTime(startTime, endTime),
              roomName: roomName || DEFAULT_PLANNING_CLASSROOM,
              content: content.trim(),
              // Omitted when there is nothing to say (and nothing stored), so a
              // database without the notes migration keeps saving sessions.
              ...(showNotes && (notes.trim() || initial?.notes)
                ? { notes: notes.trim() }
                : {}),
              ...(teacherOptions ? { teacherId: teacherId || undefined } : {}),
            });
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
