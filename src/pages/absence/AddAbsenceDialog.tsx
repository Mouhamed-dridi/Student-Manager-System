import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  insertAttendanceRecords,
  listPrograms,
  listStudents,
  listTeachers,
  listTrainings,
  updateAttendanceRecord,
  type AttendanceRecord,
} from "@/lib/api";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { Student } from "@/pages/students/StudentForm";

const PROGRAMS = ["BTP", "BTS", "CAP"] as const;

interface ProgramOption {
  id: string;
  code: string;
}

interface TrainingOption {
  name: string;
  programId: string;
}

interface PersonOption {
  name: string;
  program: string;
  training: string;
}

interface AddAbsenceDialogProps {
  initial?: AttendanceRecord;
  onSaved: () => void;
  onClose: () => void;
}

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddAbsenceDialog({
  initial,
  onSaved,
  onClose,
}: AddAbsenceDialogProps) {
  const [type, setType] = useState<"student" | "teacher">(
    initial?.type ?? "student",
  );
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<TrainingOption[]>([]);
  const [personName, setPersonName] = useState(initial?.fullName ?? "");
  const [program, setProgram] = useState(initial?.program ?? "");
  const [training, setTraining] = useState(initial?.training ?? "");
  const [date, setDate] = useState(initial?.date || todayLocal);
  const [time, setTime] = useState(initial?.time ?? nowTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = initial !== undefined;

  useEffect(() => {
    let cancelled = false;
    const load =
      type === "student"
        ? listStudents().then((students) =>
            students.map((s: Student) => ({
              name: s.fullName,
              program: s.program,
              training: s.training,
            })),
          )
        : listTeachers().then((teachers) =>
            teachers.map((t: Teacher) => ({
              name: t.fullName,
              program: t.program ?? "",
              training: t.training ?? "",
            })),
          );
    Promise.all([
      load,
      listPrograms(),
      listTrainings(),
    ])
      .then(([options, programs, trainings]) => {
        if (cancelled) return;
        setPeople(options);
        setProgramOptions(programs.map((p) => ({ id: p.id, code: p.code })));
        setAllTrainings(
          trainings.map((t) => ({
            name: t.name,
            programId: t.program_id,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type]);

  const selectedProgramId = useMemo(
    () => programOptions.find((p) => p.code === program)?.id,
    [program, programOptions],
  );

  const trainingOptions = useMemo(() => {
    const options = allTrainings
      .filter(
        (t) => !selectedProgramId || t.programId === selectedProgramId,
      )
      .map((t) => t.name);
    if (training.trim() && !options.includes(training.trim())) {
      options.unshift(training.trim());
    }
    return [...new Set(options)];
  }, [allTrainings, selectedProgramId, training]);

  const handleTypeChange = (value: string | null) => {
    const next = value === "teacher" ? "teacher" : "student";
    if (isEditing) return;
    setType(next);
    setPersonName("");
    setProgram("");
    setTraining("");
    setPeople([]);
  };

  const handlePersonChange = (value: string | null) => {
    const name = value ?? "";
    setPersonName(name);
    const person = people.find((p) => p.name === name);
    if (!person) return;
    // Auto-fill from the selected person's profile, overridable below. For
    // teachers the values come from their teachers-table record.
    setProgram(person.program);
    setTraining(person.training);
  };

  const handleSave = async () => {
    if (!personName.trim() || !date) return;
    setSaving(true);
    setError(null);
    const input = {
      type,
      fullName: personName.trim(),
      program: program.trim() || null,
      training: training.trim() || null,
      date,
      time: time || null,
    };
    try {
      if (isEditing && initial) {
        await updateAttendanceRecord(initial.id, input);
      } else {
        await insertAttendanceRecords([input]);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Absence" : "Add Absence"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={handleTypeChange}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Full Name</Label>
            <Select
              value={personName}
              onValueChange={handlePersonChange}
              disabled={people.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    people.length === 0
                      ? "No students/teachers found"
                      : "Select a person"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {personName && !people.some((p) => p.name === personName) && (
                  <SelectItem value={personName}>{personName}</SelectItem>
                )}
                {people.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={program}
                onValueChange={(value) => {
                  setProgram(value ?? "");
                  setTraining("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Training</Label>
              <Select
                value={training}
                onValueChange={(value) => setTraining(value ?? "")}
                disabled={trainingOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      trainingOptions.length === 0
                        ? "No trainings for this program"
                        : "Select training"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {trainingOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="absence-date">Date</Label>
              <Input
                id="absence-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="absence-time">Time</Label>
              <Input
                id="absence-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Picking a student or teacher auto-fills their program and training
            from their profile; you can still override them.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!personName.trim() || !date || saving}
          >
            {saving
              ? "Saving…"
              : isEditing
                ? "Save Changes"
                : "Save Absence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}