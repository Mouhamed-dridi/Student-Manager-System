import { useEffect, useState } from "react";
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
  listStudents,
  listTeachers,
} from "@/lib/api";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { Student } from "@/pages/students/StudentForm";

interface PersonOption {
  name: string;
  className: string;
}

interface AddAbsenceDialogProps {
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
  onSaved,
  onClose,
}: AddAbsenceDialogProps) {
  const [type, setType] = useState<"student" | "teacher">("student");
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [personName, setPersonName] = useState("");
  const [className, setClassName] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState(nowTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load =
      type === "student"
        ? listStudents().then((students) =>
            students.map((s: Student) => ({
              name: s.fullName,
              className: [s.training, s.program].filter(Boolean).join(" · "),
            })),
          )
        : listTeachers().then((teachers) =>
            teachers.map((t: Teacher) => ({
              name: t.fullName,
              className: t.specialty,
            })),
          );
    load
      .then((options) => {
        if (!cancelled) setPeople(options);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type]);

  const handleTypeChange = (value: string | null) => {
    const next = value === "teacher" ? "teacher" : "student";
    setType(next);
    setPersonName("");
    setClassName("");
    setPeople([]);
  };

  const handlePersonChange = (value: string | null) => {
    const name = value ?? "";
    setPersonName(name);
    const person = people.find((p) => p.name === name);
    setClassName(person?.className ?? "");
  };

  const handleSave = async () => {
    if (!personName.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      await insertAttendanceRecords([
        {
          type,
          fullName: personName.trim(),
          className: className.trim() || null,
          date,
          time: time || null,
        },
      ]);
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
          <DialogTitle>Add Absence</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={handleTypeChange}
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
                {people.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="absence-class">Class Name</Label>
            <Input
              id="absence-class"
              placeholder="Class / program / specialty"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
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

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!personName.trim() || !date || saving || people.length === 0}
          >
            {saving ? "Saving…" : "Save Absence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}