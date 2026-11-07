// Operator "Emploi des examens" — the specialised session dialog.
//
// The shared PlanningEntryForm is built for a lesson (topic, internal note,
// online meeting platform, custom times). An exam sitting needs none of that:
// a date, one of the standard 2-hour slots, the branch, the subject, the
// supervisor, the room and the exam kind, and nothing else. Using the shared
// form here would show textareas whose value has no meaning for an exam, so
// this dialog offers the restricted set instead.
//
// It writes through the same `insertPlanning()` as the rest of the timetable,
// so the probes for the optional planning columns (session_type, room_name,
// class/time, scope) keep applying — a database missing one of them fails with
// the usual "run <file>.sql" message rather than a raw PostgREST error.

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { errorMessage, insertPlanning } from "@/lib/api";
import { formatLongDate } from "@/pages/student-portal/scheduleDates";
import { PLANNING_SUBJECTS } from "@/pages/branches/planningSubjects";
import {
  DEFAULT_PLANNING_CLASSROOM,
  PLANNING_CLASSROOMS,
  PLANNING_EXAM_SESSION_TYPES,
  PLANNING_TIME_SLOTS,
} from "@/pages/teacher-portal/planning";
import type { PlanningSessionType } from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";

interface AddExamSessionModalProps {
  /** "BTS · Réseaux et sécurité informatique" — fixed by the branch. */
  branchLabel: string;
  /** Branch programme id, written as the session scope when supported. */
  branchProgramId?: string;
  /** Branch training id, written as the session scope when supported. */
  branchTrainingId: string;
  /** Day the '+' was clicked on. */
  initialDate: string;
  /** Slot the '+' belongs to, e.g. "08:00 - 10:00". */
  initialSlot?: string;
  teachers: Teacher[];
  onClose: () => void;
  /** Refresh the timetable after the insert. */
  onSaved: () => Promise<void>;
}

export default function AddExamSessionModal({
  branchLabel,
  branchProgramId,
  branchTrainingId,
  initialDate,
  initialSlot,
  teachers,
  onClose,
  onSaved,
}: AddExamSessionModalProps) {
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<string>(
    initialSlot ?? PLANNING_TIME_SLOTS[0],
  );
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState<string>(DEFAULT_PLANNING_CLASSROOM);
  const [sessionType, setSessionType] = useState<PlanningSessionType>(
    PLANNING_EXAM_SESSION_TYPES[0],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(date && slot && subject && teacherId && room);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await insertPlanning({
        id: crypto.randomUUID(),
        teacherId,
        date,
        course: subject,
        sessionType,
        className: branchLabel,
        programId: branchProgramId || undefined,
        trainingId: branchTrainingId,
        sessionTime: slot,
        roomName: room,
        // An exam has no lesson topic; kept empty rather than guessed.
        content: "",
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add exam session</DialogTitle>
          <DialogDescription>
            {branchLabel} · {formatLongDate(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="exam-date">Date</Label>
            <Input
              id="exam-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Time slot</Label>
            <Select value={slot} onValueChange={(value) => setSlot(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a time slot" />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_TIME_SLOTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Class / Branch</Label>
            <div className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 text-sm">
              <span className="truncate">{branchLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Fixed by the branch this timetable belongs to.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Session type</Label>
            <Select
              value={sessionType}
              onValueChange={(value) => {
                const next = PLANNING_EXAM_SESSION_TYPES.find(
                  (option) => option === value,
                );
                if (next) setSessionType(next);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_EXAM_SESSION_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select
              value={subject}
              onValueChange={(value) => setSubject(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_SUBJECTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Teacher</Label>
            <Select
              value={teacherId}
              onValueChange={(value) => setTeacherId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Classroom / Room</Label>
            <Select value={room} onValueChange={(value) => setRoom(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select classroom" />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_CLASSROOMS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
