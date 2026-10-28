import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

  // The class roster is read for the teacher's assigned program/training, which
  // teacherCourseAssignment() resolves from the profile columns first, else
  // from the class of their existing courses. undefined = still resolving;
  // null = no assignment.
  const [assignment, setAssignment] = useState<TeacherCourseAssignment | null | undefined>(undefined);
  // Populated automatically once the assignment resolves — there is no import
  // action on this page, the teacher only ever sees their own class.
  const [imported, setImported] = useState<Student[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Read by importClass, which stays referentially stable so the realtime
  // effect below never re-subscribes mid-session.
  const teacherIdRef = useRef("");

  const importClass = useCallback(async () => {
    if (!teacherIdRef.current) return;
    try {
      const { students } = await importClassForTeacher(teacherIdRef.current);
      setImported(students);
      setImportError(null);
    } catch (err) {
      setImportError(errorMessage(err));
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
          const assigned =
            resolved.program && resolved.training ? resolved : null;
          setAssignment(assigned);
          if (!assigned) return;
          // Load the class roster right away: the page has no Import action.
          try {
            const { students: classStudents } = await importClassForTeacher(
              record.id,
            );
            if (!cancelled) setImported(classStudents);
          } catch (err) {
            if (!cancelled) setImportError(errorMessage(err));
          }
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

  if (
    teacher === undefined ||
    roster === null ||
    assignment === undefined ||
    // With an assignment the class roster is fetched automatically, so wait for
    // it instead of flashing the fallback table. A failed fetch shows the error
    // and falls back to the course-based roster rather than spinning forever.
    (assignment !== null && imported === null && !importError)
  ) {
    return <DataLoading label="Loading your class…" />;
  }

  const sorted = [...roster].sort((a, b) =>
    (a.fullName ?? "").localeCompare(b.fullName ?? ""),
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold">My Class</h2>

      {assignment === null && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          There is no class assigned yet. Ask the center to set your program and
          training on your profile.
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
            {imported.length} student{imported.length === 1 ? "" : "s"} enrolled
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
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Enrolled Track</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imported.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>{s.phone || "—"}</TableCell>
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
                  Add a course — students enrolled in it will appear here.
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