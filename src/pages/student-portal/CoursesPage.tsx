import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import StudentCourseDetail from "@/components/StudentCourseDetail";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, subscribeToTable } from "@/lib/api";
import { loadScheduledCourses } from "@/lib/trainings";
import type { ScheduledCourseView } from "@/lib/trainings";
import type { Student } from "@/pages/students/StudentForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { loadCurrentStudent } from "./currentStudent";

export default function CoursesPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  // The course opened as a detail view, or null while the grid is showing.
  const [selected, setSelected] = useState<ScheduledCourseView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (record: Student) => {
    try {
      setError(null);
      const list = await loadScheduledCourses(
        record.program,
        record.training,
        {
          programId: record.programId,
          trainingId: record.trainingId,
        },
      );
      setCourses(list);
      // Keep an open course in sync with the teacher's live edits; fall back to
      // the snapshot when the row no longer exists.
      setSelected((open) => {
        if (!open) return null;
        return list.find((c) => c.id === open.id) ?? open;
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled) return;
        setStudent(record);
        if (record) await refresh(record);
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!student) return;
    return subscribeToTable("courses", () => void refresh(student));
  }, [student, refresh]);

  useRefetchOnFocus(() => {
    if (student) void refresh(student);
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold">Courses</h2>

      {student === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      ) : student === undefined ? (
        <DataLoading label="Loading courses…" />
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned to {student.training || "—"} ({student.program})
          </p>

          {error && (
            <div className="mt-4">
              <DataError message={error} />
            </div>
          )}

          {courses === null ? (
            !error && <DataLoading label="Loading courses…" />
          ) : selected ? (
            <div className="mt-4">
              <StudentCourseDetail
                course={selected}
                studentId={student.id}
                studentName={student.fullName}
                onBack={() => setSelected(null)}
                backLabel="Back to courses"
              />
            </div>
          ) : courses.length === 0 ? (
            <Card className="mt-4 max-w-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">
                  No courses scheduled yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing has been planned for your program and training so far.
                  Please check back later.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4">
              <CourseCardsGrid
                courses={courses}
                training={student.training}
                onOpenCourse={setSelected}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
