// Operator "Planning PFE" — the specialised defence / internship dialog.
//
// A PFE session is a panel event, not a lesson: a date, one of the standard
// 2-hour slots, the class, the room, the kind (PFE / STAGE / Soutenance) and
// the jury committee. It does not carry a subject, a topic or an internal note,
// so the shared entry form would offer fields that mean nothing here (and its
// single-teacher picker cannot express a jury). This dialog offers exactly the
// PFE field set.
//
// The jury is a true multi-select: every selected teacher is written to
// `planning.jury_teacher_ids`. `planning.teacher_id` still holds the session's
// lead teacher — the first name in the list — because that is the column the
// teacher portal and the conflict checks read; the branch grid badges the whole
// panel on the session card. The picker is inline rather than a portalled
// dropdown: a list on document.body counts as "outside" for the dialog and a
// click on a juror would dismiss the modal.
//
// Writes go through `insertPlanning()` / `updatePlanning()` like the rest of
// the timetable, so the optional-column probes keep applying: a database
// missing `jury_teacher_ids` fails with the "run
// supabase/planning-jury-migration.sql" message instead of dropping the jury.

import { useState } from "react";
import { Check, Loader2, Search, Trash2, X } from "lucide-react";
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
import { errorMessage, insertPlanning, updatePlanning } from "@/lib/api";
import { formatLongDate } from "@/pages/student-portal/scheduleDates";
import {
  DEFAULT_PLANNING_CLASSROOM,
  PLANNING_CLASSROOMS,
  PLANNING_PFE_SESSION_TYPES,
  PLANNING_TIME_SLOTS,
  planningSlotKey,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningClassOption,
  PlanningRecord,
  PlanningSessionType,
} from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";

interface AddPFESessionModalProps {
  /** "BTS · Réseaux et sécurité informatique" — the branch the grid belongs to. */
  branchLabel: string;
  /** Branch programme id, written as the session scope when supported. */
  branchProgramId?: string;
  /** Branch training id, written as the session scope when supported. */
  branchTrainingId: string;
  /** Classes the grid knows about; the branch itself is the default. */
  classes: PlanningClassOption[];
  /** Day the '+' was clicked on. */
  initialDate: string;
  /** Slot the '+' belongs to, e.g. "08:00 - 10:00". */
  initialSlot?: string;
  /** Session being edited; omitted when adding a new one. */
  entry?: PlanningRecord | null;
  teachers: Teacher[];
  onClose: () => void;
  /** Refresh the timetable after the write. */
  onSaved: () => Promise<void>;
  /** Editing only: hand the session to the caller's delete confirmation. */
  onDelete?: () => void;
}

export default function AddPFESessionModal({
  branchLabel,
  branchProgramId,
  branchTrainingId,
  classes,
  initialDate,
  initialSlot,
  entry,
  teachers,
  onClose,
  onSaved,
  onDelete,
}: AddPFESessionModalProps) {
  const [date, setDate] = useState(entry?.date?.slice(0, 10) ?? initialDate);
  // A stored window that is not one of the preset slots stays selectable, so
  // editing an old row never silently moves it onto a standard slot.
  const storedSlot = entry?.sessionTime
    ? planningSlotKey(entry.sessionTime)
    : "";
  const [slot, setSlot] = useState(
    storedSlot || initialSlot || PLANNING_TIME_SLOTS[0],
  );
  const [className, setClassName] = useState(entry?.className ?? branchLabel);
  const [roomName, setRoomName] = useState(
    entry?.roomName?.trim() || DEFAULT_PLANNING_CLASSROOM,
  );
  const [sessionType, setSessionType] = useState<PlanningSessionType>(
    PLANNING_PFE_SESSION_TYPES.find(
      (option) => option === entry?.sessionType,
    ) ?? PLANNING_PFE_SESSION_TYPES[0],
  );
  // The whole panel, lead teacher included: the first pick becomes the
  // session's `teacher_id`, the rest only live in the jury array. A PFE row
  // written before this dialog existed has no panel, so its lead teacher is
  // offered back as the first juror instead of opening with an empty field.
  const [jury, setJury] = useState<string[]>(() => {
    if (entry?.juryTeacherIds && entry.juryTeacherIds.length > 0) {
      return entry.juryTeacherIds;
    }
    return entry?.teacherId ? [entry.teacherId] : [];
  });
  const [juryQuery, setJuryQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teacherOptions = [...teachers]
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((teacher) => ({ id: teacher.id, label: teacher.fullName }));
  const teacherNameById = new Map(
    teacherOptions.map((option) => [option.id, option.label]),
  );
  const juryNeedle = juryQuery.trim().toLowerCase();
  const juryMatches = juryNeedle
    ? teacherOptions.filter((option) =>
        option.label.toLowerCase().includes(juryNeedle),
      )
    : teacherOptions;

  const toggleJuror = (id: string) => {
    setJury((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const slotOptions: string[] =
    storedSlot && !(PLANNING_TIME_SLOTS as readonly string[]).includes(storedSlot)
      ? [storedSlot, ...PLANNING_TIME_SLOTS]
      : [...PLANNING_TIME_SLOTS];
  const roomOptions: string[] =
    roomName && !(PLANNING_CLASSROOMS as readonly string[]).includes(roomName)
      ? [roomName, ...PLANNING_CLASSROOMS]
      : [...PLANNING_CLASSROOMS];

  const canSave = Boolean(
    date && slot && className && roomName && jury.length > 0,
  );

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);

    const selectedClass = classes.find((option) => option.label === className);
    // Editing a session whose class is not in the list keeps its stored scope,
    // exactly like the shared form does.
    const keepsExisting = className === (entry?.className ?? "");
    const programId =
      selectedClass?.programId ||
      (keepsExisting ? entry?.programId : branchProgramId) ||
      undefined;
    const trainingId =
      selectedClass?.trainingId ||
      (keepsExisting ? entry?.trainingId : branchTrainingId) ||
      undefined;
    const teacherId = jury[0];

    try {
      if (entry) {
        // An edit re-writes every PFE field from this dialog; subject, topic
        // and note are not part of it (see the clearing below).
        await updatePlanning(entry.id, {
          // No subject, topic or note on a PFE session: the write clears any
          // value a legacy row carried instead of leaving it behind.
          course: undefined,
          sessionType,
          className,
          programId,
          trainingId,
          sessionTime: slot,
          roomName,
          content: "",
          // A note left over from an older row is cleared too, so nothing a PFE
          // session no longer offers survives invisibly.
          ...(entry.notes ? { notes: "" } : {}),
          juryTeacherIds: jury,
          teacherId,
          date,
        });
      } else {
        await insertPlanning({
          id: crypto.randomUUID(),
          teacherId,
          date,
          sessionType,
          className,
          programId,
          trainingId,
          sessionTime: slot,
          roomName,
          content: "",
          juryTeacherIds: jury,
        });
      }
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
          <DialogTitle>
            {entry ? "Edit PFE session" : "Add PFE session"}
          </DialogTitle>
          <DialogDescription>
            {className || branchLabel} · {formatLongDate(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pfe-date">Date</Label>
            <Input
              id="pfe-date"
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
                {slotOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Class / Branch</Label>
            <Select
              value={className}
              onValueChange={(value) => setClassName(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((option) => (
                  <SelectItem key={option.label} value={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Classroom / Room</Label>
            <Select
              value={roomName}
              onValueChange={(value) => setRoomName(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select classroom" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Session type</Label>
            <Select
              value={sessionType}
              onValueChange={(value) => {
                const next = PLANNING_PFE_SESSION_TYPES.find(
                  (option) => option === value,
                );
                if (next) setSessionType(next);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_PFE_SESSION_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Jury committee</Label>
              <span className="text-xs text-muted-foreground">
                {jury.length} selected
              </span>
            </div>

            {jury.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {jury.map((id, index) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs font-medium"
                  >
                    {index === 0 ? (
                      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Lead
                      </span>
                    ) : null}
                    {teacherNameById.get(id) ?? "Unknown teacher"}
                    <button
                      type="button"
                      aria-label={`Remove ${teacherNameById.get(id) ?? "teacher"} from the jury`}
                      onClick={() => toggleJuror(id)}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={juryQuery}
                placeholder="Search a teacher to add to the jury…"
                onChange={(event) => setJuryQuery(event.target.value)}
              />
            </div>

            <div
              role="listbox"
              aria-multiselectable="true"
              aria-label="Jury committee"
              className="max-h-40 overflow-y-auto rounded-lg border p-1"
            >
              {juryMatches.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {teacherOptions.length === 0
                    ? "No teachers exist yet."
                    : "No teacher matches that name."}
                </p>
              ) : (
                juryMatches.map((option) => {
                  const selected = jury.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleJuror(option.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected ? <Check className="h-4 w-4" /> : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Select everyone on the panel — supervisor, president, examiner.
              The first name is the session&apos;s lead teacher.
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-3">
          {entry && onDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="mr-auto text-destructive"
              disabled={saving}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete session
            </Button>
          ) : null}
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
            {entry ? "Save changes" : "Add session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
