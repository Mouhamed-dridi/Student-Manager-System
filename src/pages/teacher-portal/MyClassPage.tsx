import { useEffect, useState } from "react";
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
import { classRosterForTeacher, errorMessage, subscribeToTable } from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

export default function MyClassPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [courseCount, setCourseCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
  }, [teacher]);

  // Quiet fallback: refresh the roster once if the tab regains focus after
  // being in the background for a while, in case realtime silently dropped.
  useRefetchOnFocus(async () => {
    if (!teacher) return;
    try {
      const { courses, students } = await classRosterForTeacher(teacher.id);
      setCourseCount(courses.length);
      setRoster(students);
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
              Add a course first — students enrolled in it will appear here.
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
    </div>
  );
}