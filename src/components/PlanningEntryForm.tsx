import { useState } from "react";
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
  PLANNING_CLASSROOMS,
  PLANNING_SESSION_TYPES,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningClassOption,
  PlanningEntryValues,
  PlanningRecord,
  PlanningSessionType,
} from "@/pages/teacher-portal/planning";

// Shared by the teacher Planning page and the operator Planification editor so
// the two writes cannot drift apart. The teacher portal renders it without
// `teacherOptions` (an entry always belongs to the signed-in teacher); the
// operator editor passes them to reassign a session to another teacher.

const NO_CLASS = "__none";

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
  const initialTime = parseSessionTime(initial?.sessionTime);
  const [startTime, setStartTime] = useState(initialTime.start);
  const [endTime, setEndTime] = useState(initialTime.end);
  const [roomName, setRoomName] = useState(
    initial?.roomName?.trim() || DEFAULT_PLANNING_CLASSROOM,
  );
  // A room stored before the list was fixed (or typed by hand) stays
  // selectable, so editing an old entry never silently moves it.
  const roomOptions: string[] =
    roomName && !(PLANNING_CLASSROOMS as readonly string[]).includes(roomName)
      ? [roomName, ...PLANNING_CLASSROOMS]
      : [...PLANNING_CLASSROOMS];
  const [content, setContent] = useState(initial?.content ?? "");

  const timeInvalid = Boolean(startTime && endTime && endTime < startTime);
  const teacherMissing = Boolean(teacherOptions && !teacherId);
  const valid = content.trim() !== "" && !timeInvalid && !teacherMissing;

  return (
    <div className="space-y-4">
      {teacherOptions ? (
        <div className="space-y-2">
          <Label>Teacher</Label>
          <Select
            value={teacherId}
            onValueChange={(value) => setTeacherId(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select teacher" />
            </SelectTrigger>
            <SelectContent>
              {teacherOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Changing this moves the session to that teacher&apos;s planning.
          </p>
        </div>
      ) : null}
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
              <SelectItem key={c.label} value={c.label}>
                {c.label}
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
      <div className="space-y-2">
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
