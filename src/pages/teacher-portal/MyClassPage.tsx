import { useCallback, useEffect, useRef, useState } from "react";
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
  importClassForTeacher,
  teacherCourseAssignment,
  subscribeToTable,
  type TeacherCourseAssignment,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

/** `students.blocked` is the only status flag a student row has, so Status is
 *  derived from it exactly like the operator's User Management table. */
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

  // Class import is locked to the teacher's own program/training, resolved by
  // the same teacherCourseAssignment() that pins their course writes: the
  // profile columns first, else the class of their existing courses.
  // undefined = still resolving; null = no assignment, so nothing is importable.
  const [assignment, setAssignment] = useState<TeacherCourseAssignment | null | undefined>(undefined);
  const [imported, setImported] = useState<Student[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // What the realtime/focus handlers re-import. Only the Import button writes
  // it, so a live update never changes which class is on screen.
  const classSelection = useRef<{
    programId?: string;
    trainingId?: string;
  }>({});

  // Read by importClass, which stays referentially stable so the realtime
  // effect below never re-subscribes mid-session.
  const teacherIdRef = useRef("");

  const importClass = useCallback(async () => {
    if (!teacherIdRef.current) return;
    setImporting(true);
    setImportError(null);
    try {
      const { students } = await importClassForTeacher(
        teacherIdRef.current,
        classSelection.current,
      );
      setImported(students);
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
        teacherIdRef.current = record.id;
        try {
          const [{ courses, students }, resolved] = await Promise.all([
            classRosterForTeacher(record.id),
            teacherCourseAssignment(record.id),
          ]);
          if (cancelled) return;
          setCourseCount(courses.length);
          setRoster(students);
          setAssignment(
            resolved.program && resolved.training ? resolved : null,
          );
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

  if (teacher === undefined || roster === null || assignment === undefined) {
    return <DataLoading label="Loading your class…" />;
  }

  const sorted = [...roster].sort((a, b) =>
    (a.fullName ?? "").localeCompare(b.fullName ?? ""),
  );

  const classLabel = assignment
    ? `${assignment.program} · ${assignment.training}`
    : "";

  // The dropdown is labelled "Specialty" and keyed off the teacher's own
  // `specialty` text, which is the thing they recognise (and the thing that
  // resolves their class). The training it maps to is stated underneath rather
  // than substituted for it, so the box never disagrees with the header.
  const specialtyDisplay = teacher?.specialty || assignment?.training || "";

  // Only for a teacher with no program/training AND no specialty that resolves
  // to a training — at that point the specialty is all we can show.
  const specialtyHint = assignment ? "" : (teacher?.specialty ?? "");

  return (
    <div>
      <h2 className="text-2xl font-semibold">My Class</h2>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Training Type</Label>
          <Select value={assignment?.programId ?? ""} disabled>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Not assigned" />
            </SelectTrigger>
            <SelectContent>
              {/* Single option by design: the class comes from the profile, so
                  there is no other training type this teacher may import. */}
              {assignment && (
                <SelectItem value={assignment.programId || "none"}>
                  {assignment.program}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Specialty</Label>
          <Select value={specialtyDisplay} disabled>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Not assigned" />
            </SelectTrigger>
            <SelectContent>
              {specialtyDisplay && (
                <SelectItem value={specialtyDisplay}>
                  {specialtyDisplay}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {assignment && (
            <p className="text-xs text-muted-foreground">
              Class: {classLabel}
            </p>
          )}
        </div>

        <Button
          onClick={() => {
            classSelection.current = {
              programId: assignment?.programId || undefined,
              trainingId: assignment?.trainingId || undefined,
            };
            void importClass();
          }}
          disabled={!assignment || importing}
        >
          {importing ? "Importing…" : "Import"}
        </Button>
      </div>

      {assignment === null && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          There is no class to import yet.
          {specialtyHint ? (
            <>
              {" "}
              No training matches your specialty &ldquo;{specialtyHint}&rdquo;.
              Ask the center to set the program and training on your profile.
            </>
          ) : (
            " Ask the center to set your specialty, program and training on your profile."
          )}
        </p>
      )}

      {importError && (
        <div className="mt-4">
          <DataError message={importError} />
        </div>
      )}

      {imported ? (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted-foreground">
            {imported.length} student{imported.length === 1 ? "" : "s"} in{" "}
            {classLabel}
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
                  Import your class above to see its students, or add a course —
                  students enrolled in it will appear here.
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