import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import {
  classRosterForTeacher,
  errorMessage,
  listPrograms,
  listTrainings,
  studentsForClass,
  subscribeToTable,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

interface ProgramOption {
  id: string;
  code: string;
}

interface TrainingOption {
  id: string;
  name: string;
  programId: string;
}

/** Mirrors the operator's Student form: program is stored as a code, the
 *  training as its display name, and `students.blocked` is the only status
 *  flag a student row has. */
function statusBadge(blocked?: boolean) {
  if (blocked) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      Active
    </span>
  );
}

export default function MyClassPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [courseCount, setCourseCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Class import: the same programs/trainings the operator picks from when
  // creating a student, so the selection always matches real enrollments.
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<TrainingOption[]>([]);
  const [programId, setProgramId] = useState<string | null>(null);
  const [trainingId, setTrainingId] = useState<string | null>(null);
  const [imported, setImported] = useState<Student[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    listPrograms()
      .then((rows) => setProgramOptions(rows.map((r) => ({ id: r.id, code: r.code }))))
      .catch(() => {});
    listTrainings()
      .then((rows) =>
        setAllTrainings(
          rows.map((r) => ({ id: r.id, name: r.name, programId: r.program_id })),
        ),
      )
      .catch(() => {});
  }, []);

  // Trainings belong to a program, so the track list follows the type.
  const trainingOptions = useMemo(
    () => (programId ? allTrainings.filter((t) => t.programId === programId) : []),
    [programId, allTrainings],
  );

  const selectedProgram = programOptions.find((p) => p.id === programId);
  const selectedTraining = allTrainings.find((t) => t.id === trainingId);
  const classLabel = [selectedProgram?.code, selectedTraining?.name]
    .filter(Boolean)
    .join(" · ");

  // The class currently on screen, kept in a ref so the realtime and focus
  // handlers can re-run the import without re-subscribing on every dropdown
  // change. Only the Import button writes it, so a live update never silently
  // swaps the class the teacher is looking at for a different one.
  const classSelection = useRef<{
    programId: string;
    trainingId?: string;
  } | null>(null);

  const importClass = useCallback(async () => {
    const selection = classSelection.current;
    if (!selection) return;
    setImporting(true);
    setImportError(null);
    try {
      setImported(await studentsForClass(selection));
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled) return;
        if (!record) {
          setTeacher(null);
          return;
        }
        setTeacher(record);
        try {
          const { courses, students } = await classRosterForTeacher(record.id);
          if (cancelled) return;
          setCourseCount(courses.length);
          setRoster(students);
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live roster: courses/students added, edited, or removed by the operator
  // or the teacher in another browser appear here without a manual refresh.
  // Runs once the teacher record resolves (undefined/null never subscribe).
  useEffect(() => {
    if (!teacher) return;
    const refresh = async () => {
      try {
        const { courses, students } = await classRosterForTeacher(teacher.id);
        setCourseCount(courses.length);
        setRoster(students);
        await importClass();
      } catch (err) {
        setError(errorMessage(err));
      }
    };
    const offStudents = subscribeToTable("students", refresh);
    const offCourses = subscribeToTable("courses", refresh);
    return () => {
      offStudents();
      offCourses();
    };
  }, [teacher, importClass]);

  // Quiet fallback: refresh the roster once if the tab regains focus after
  // being in the background for a while, in case realtime silently dropped.
  useRefetchOnFocus(async () => {
    if (!teacher) return;
    try {
      const { courses, students } = await classRosterForTeacher(teacher.id);
      setCourseCount(courses.length);
      setRoster(students);
      await importClass();
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || roster === null) {
    return <DataLoading label="Loading your class…" />;
  }

  const sorted = [...roster].sort((a, b) =>
    (a.fullName ?? "").localeCompare(b.fullName ?? ""),
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold">My Class</h2>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Training Type</Label>
          <Select
            value={programId}
            onValueChange={(value) => {
              setProgramId(value);
              setTrainingId(null);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select training type" />
            </SelectTrigger>
            <SelectContent>
              {programOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Specialty</Label>
          <Select
            value={trainingId}
            onValueChange={(value) => setTrainingId(value)}
            disabled={!programId}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select specialty" />
            </SelectTrigger>
            <SelectContent>
              {trainingOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            if (!programId) return;
            classSelection.current = {
              programId,
              trainingId: trainingId ?? undefined,
            };
            void importClass();
          }}
          disabled={!programId || importing}
        >
          {importing ? "Importing…" : "Import"}
        </Button>
      </div>

      {importError && (
        <div className="mt-4">
          <DataError message={importError} />
        </div>
      )}

      {imported ? (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted-foreground">
            {imported.length} student{imported.length === 1 ? "" : "s"} in{" "}
            {classLabel || "the selected class"}
          </p>
          {imported.length === 0 ? (
            <Card className="max-w-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">No students found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nobody is enrolled in this class yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Enrolled Track</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imported.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>{s.email || "—"}</TableCell>
                      <TableCell>
                        {[s.program, s.training].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell>{statusBadge(s.blocked)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <>
          {courseCount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {sorted.length} student{sorted.length === 1 ? "" : "s"} enrolled in
              your course{sorted.length === 1 ? "" : "s"}
            </p>
          )}

          {error && (
            <div className="mt-4">
              <DataError message={error} />
            </div>
          )}

          {courseCount === 0 ? (
            <Card className="mt-4 max-w-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">No courses yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a training type and specialty above to import a class, or
                  add a course — students enrolled in it will appear here.
                </p>
              </CardContent>
            </Card>
          ) : sorted.length === 0 ? (
            <Card className="mt-4 max-w-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">No students yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Students appear here once they are assigned to a program and
                  training you teach.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>{s.phone || "—"}</TableCell>
                      <TableCell>{s.email || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}