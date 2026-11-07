// Add / edit one absence with three target types:
//   student    -> search an individual student, program/training locked from
//                 their profile
//   teacher    -> same, from the teachers table
//   full_class -> pick a program tier (CAP/BTP/BTS) and one of its trainings
//                 (branches) instead of a person
//
// Writes through insertAttendanceRecords/updateAttendanceRecord, which map the
// target onto attendance.target_type/user_id/program_tier/training_id/
// absence_date plus the Time From / Time To window (time_from/time_to in
// supabase/absences-migration.sql) while keeping the legacy denormalized
// columns in sync for the Attendance log.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
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
  errorMessage,
  insertAttendanceRecords,
  listPrograms,
  listStudents,
  listTeachers,
  listTrainings,
  updateAttendanceRecord,
  type AttendanceInput,
  type AttendanceRecord,
  type AttendanceTargetType,
} from "@/lib/api";

const PROGRAMS = ["CAP", "BTP", "BTS"] as const;

const TARGET_LABELS: Record<AttendanceTargetType, string> = {
  student: "Individual Student",
  teacher: "Individual Teacher",
  full_class: "Full Class / Branch",
};

interface ProgramOption {
  id: string;
  code: string;
}

interface TrainingOption {
  id: string;
  name: string;
  programId: string;
}

interface PersonOption {
  id: string;
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

/**
 * Older rows store one value in `time`, newer ones a "08:00 - 10:00" window.
 * Splits either into [from, to] so editing prefills both fields.
 */
function splitTimeWindow(value?: string | null): [string, string] | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const [from = "", to = ""] = trimmed.split(/\s*[–-]\s*/);
  return [from.trim(), to.trim()];
}

export default function AddAbsenceDialog({
  initial,
  onSaved,
  onClose,
}: AddAbsenceDialogProps) {
  const isEditing = initial !== undefined;
  const initialTarget: AttendanceTargetType =
    initial?.targetType ?? initial?.type ?? "student";

  const [type, setType] = useState<AttendanceTargetType>(initialTarget);
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<TrainingOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Individual target: search box + chosen person.
  const [query, setQuery] = useState(
    initialTarget === "full_class" ? "" : (initial?.fullName ?? ""),
  );
  const [selected, setSelected] = useState<PersonOption | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<number | null>(null);

  // Full-class target: program tier + training/branch.
  const [programTier, setProgramTier] = useState(
    initialTarget === "full_class"
      ? (initial?.programTier ?? initial?.program ?? "")
      : "",
  );
  const [trainingId, setTrainingId] = useState(
    initialTarget === "full_class" ? (initial?.trainingId ?? "") : "",
  );

  const [date, setDate] = useState(initial?.date || todayLocal);
  const legacyTimes = splitTimeWindow(initial?.time);
  const [timeFrom, setTimeFrom] = useState(
    initial?.timeFrom ?? legacyTimes?.[0] ?? (isEditing ? "" : nowTime()),
  );
  const [timeTo, setTimeTo] = useState(
    initial?.timeTo ?? legacyTimes?.[1] ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPrograms(), listTrainings()])
      .then(([programs, trainings]) => {
        if (cancelled) return;
        setProgramOptions(programs.map((p) => ({ id: p.id, code: p.code })));
        setAllTrainings(
          trainings.map((t) => ({
            id: t.id,
            name: t.name,
            programId: t.program_id,
          })),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setOptionsError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // People are tagged with the type they were loaded for, so switching types
  // never shows the previous list for a frame. No synchronous setState here.
  const [peopleState, setPeopleState] = useState<{
    type: AttendanceTargetType;
    rows: PersonOption[];
  } | null>(null);

  useEffect(() => {
    if (type === "full_class") return;
    let cancelled = false;
    const load =
      type === "student"
        ? listStudents().then((students) =>
            students.map<PersonOption>((s) => ({
              id: s.id,
              name: s.fullName,
              program: s.program ?? "",
              training: s.training ?? "",
            })),
          )
        : listTeachers().then((teachers) =>
            teachers.map<PersonOption>((t) => ({
              id: t.id,
              name: t.fullName,
              program: t.program ?? "",
              training: t.training ?? "",
            })),
          );
    load
      .then((rows) => {
        if (!cancelled) setPeopleState({ type, rows });
      })
      .catch((err: unknown) => {
        if (!cancelled) setOptionsError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  const people = useMemo(
    () => (peopleState?.type === type ? peopleState.rows : []),
    [peopleState, type],
  );
  const loadingPeople = type !== "full_class" && peopleState?.type !== type;

  const resolveTrainingId = (
    name: string,
    programCode: string,
  ): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const programId = programOptions.find(
      (p) => p.code === programCode,
    )?.id;
    const match = allTrainings.find(
      (t) =>
        t.name === trimmed && (!programId || t.programId === programId),
    );
    return match?.id ?? null;
  };

  // Individual target values: the chosen person's profile, or the values the
  // record was saved with while editing (the person may no longer be listed).
  const editing = isEditing ? initial : undefined;
  const personName = selected?.name ?? editing?.fullName ?? query.trim();
  const personProgram =
    selected?.program ?? (editing?.program?.trim() || "");
  const personTraining =
    selected?.training ?? (editing?.training?.trim() || "");
  const trainingForPerson = selected
    ? resolveTrainingId(selected.training, selected.program)
    : resolveTrainingId(personTraining, personProgram);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.program.toLowerCase().includes(q) ||
            p.training.toLowerCase().includes(q),
        )
      : people;
    return list.slice(0, 8);
  }, [people, query]);

  const tierProgramId = programOptions.find(
    (p) => p.code === programTier,
  )?.id;

  const classTrainings = useMemo(() => {
    if (!tierProgramId) return [] as TrainingOption[];
    const byName = new Map<string, TrainingOption>();
    for (const t of allTrainings) {
      if (t.programId !== tierProgramId) continue;
      if (!byName.has(t.name)) byName.set(t.name, t);
    }
    const list = [...byName.values()];
    // Keep the record's own training selectable even if it was renamed or
    // removed from the trainings table since it was saved.
    if (trainingId && !list.some((t) => t.id === trainingId)) {
      list.unshift({
        id: trainingId,
        name: initial?.training?.trim() || "Current training",
        programId: tierProgramId,
      });
    }
    return list;
  }, [allTrainings, tierProgramId, trainingId, initial?.training]);

  const selectedClassTraining = classTrainings.find(
    (t) => t.id === trainingId,
  );

  const handleTypeChange = (value: string | null) => {
    if (isEditing) return;
    const next: AttendanceTargetType =
      value === "teacher" || value === "full_class" ? value : "student";
    setType(next);
    setSelected(null);
    setQuery("");
    setSearchOpen(false);
    setProgramTier("");
    setTrainingId("");
    setError(null);
  };

  const pickPerson = (person: PersonOption) => {
    setSelected(person);
    setQuery(person.name);
    setSearchOpen(false);
    setError(null);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const person = results[activeIndex];
      if (searchOpen && person) {
        e.preventDefault();
        pickPerson(person);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const handleTierChange = (value: string | null) => {
    setProgramTier(value ?? "");
    setTrainingId("");
  };

  // New absences must name a person picked from the search results, so the
  // locked program/training always come from a real profile.
  const hasPerson = isEditing ? Boolean(personName.trim()) : selected !== null;
  const canSave =
    Boolean(date) &&
    (type === "full_class"
      ? Boolean(programTier && trainingId)
      : hasPerson);

  const handleSave = async () => {
    if (!canSave) return;
    let input: AttendanceInput;
    if (type === "full_class") {
      const training = selectedClassTraining;
      if (!training) return;
      input = {
        type: "full_class",
        targetType: "full_class",
        fullName: training.name,
        className: training.name,
        program: programTier,
        training: training.name,
        programTier,
        trainingId: training.id,
        userId: null,
        date,
        timeFrom: timeFrom || null,
        timeTo: timeTo || null,
        absenceDate: date,
      };
    } else {
      input = {
        type,
        targetType: type,
        fullName: personName.trim(),
        className: personTraining || null,
        program: personProgram || null,
        training: personTraining || null,
        programTier: personProgram || null,
        trainingId: trainingForPerson,
        userId: selected?.id ?? editing?.userId ?? null,
        date,
        timeFrom: timeFrom || null,
        timeTo: timeTo || null,
        absenceDate: date,
      };
    }

    setSaving(true);
    setError(null);
    try {
      if (isEditing && initial) {
        await updateAttendanceRecord(initial.id, input);
      } else {
        await insertAttendanceRecords([input]);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const showSearch = type !== "full_class";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Absence" : "Add Absence"}
          </DialogTitle>
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
                <SelectItem value="student">
                  {TARGET_LABELS.student}
                </SelectItem>
                <SelectItem value="teacher">
                  {TARGET_LABELS.teacher}
                </SelectItem>
                <SelectItem value="full_class">
                  {TARGET_LABELS.full_class}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showSearch && (
            <>
              <div className="space-y-2">
                <Label htmlFor="absence-person">Full Name</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="absence-person"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(null);
                      setSearchOpen(true);
                      setActiveIndex(0);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => {
                      blurTimer.current = window.setTimeout(
                        () => setSearchOpen(false),
                        120,
                      );
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={
                      loadingPeople
                        ? "Loading people…"
                        : type === "student"
                          ? "Search a student by name…"
                          : "Search a teacher by name…"
                    }
                    autoComplete="off"
                    className="pl-8"
                  />
                  {searchOpen && !loadingPeople && query.trim() !== "" && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                      {results.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">
                          No matching {type === "student" ? "students" : "teachers"}.
                        </p>
                      ) : (
                        results.map((person, index) => (
                          <button
                            key={person.id}
                            type="button"
                            className={`flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm ${
                              index === activeIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/60"
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (blurTimer.current !== null) {
                                window.clearTimeout(blurTimer.current);
                                blurTimer.current = null;
                              }
                              pickPerson(person);
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                          >
                            <span className="truncate font-medium">
                              {person.name}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {[person.program, person.training]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selected && (
                  <p className="text-xs text-muted-foreground">
                    {selected.name}
                    {selected.program || selected.training
                      ? ` — ${[selected.program, selected.training]
                          .filter(Boolean)
                          .join(" · ")}`
                      : ""}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="absence-program">Program</Label>
                  <Input
                    id="absence-program"
                    value={personProgram || ""}
                    placeholder="—"
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absence-training">Training</Label>
                  <Input
                    id="absence-training"
                    value={personTraining || ""}
                    placeholder="—"
                    readOnly
                    disabled
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Program and training are filled from the selected profile and
                locked.
              </p>
            </>
          )}

          {type === "full_class" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Program Tier</Label>
                <Select value={programTier} onValueChange={handleTierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
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
                <Label>Training / Branch</Label>
                <Select
                  value={trainingId}
                  onValueChange={(value) => setTrainingId(value ?? "")}
                  disabled={!programTier || classTrainings.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !programTier
                          ? "Pick a program tier first"
                          : classTrainings.length === 0
                            ? "No trainings for this tier"
                            : "Select training"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classTrainings.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="absence-time-from">Time From</Label>
              <Input
                id="absence-time-from"
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="absence-time-to">Time To</Label>
              <Input
                id="absence-time-to"
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
              />
            </div>
          </div>

          {optionsError && (
            <p className="text-xs text-destructive">
              Could not load programs/trainings: {optionsError}
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Save Absence"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
