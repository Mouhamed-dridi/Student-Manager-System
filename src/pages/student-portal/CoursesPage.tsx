import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import ErrorBoundary from "@/components/ErrorBoundary";
import StudentCourseDetail from "@/components/StudentCourseDetail";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, subscribeToTable } from "@/lib/api";
import { courseKey } from "@/lib/courseDisplay";
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
      // Keep an open course in sync with the teacher's live edits. courseKey is
      // used instead of a bare `c.id === open.id` because the seeded schedule
      // entries have no id: every one of them is undefined, so that test
      // matched the first seeded course and the open detail silently jumped to
      // a different course on the next realtime update or tab refocus. Falls
      // back to the open snapshot when the course is gone entirely.
      setSelected((open) => {
        if (!open) return null;
        return list.find((c) => courseKey(c) === courseKey(open)) ?? open;
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
              {/* Coarse backstop: if the detail view itself throws, keep a way
                  back to the grid instead of an unmounted (blank) tree. The
                  key remounts the boundary when another course is opened, so a
                  previous failure is not shown against the new course. */}
              <ErrorBoundary
                key={courseKey(selected)}
                fallback={(error) => (
                  <Card>
                    <CardContent className="space-y-3 py-6">
                      <p className="text-sm font-medium">
                        This course could not be displayed.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {error.message || "An unexpected error occurred."}
                      </p>
                      <Button size="sm" onClick={() => setSelected(null)}>
                        Back to courses
                      </Button>
                    </CardContent>
                  </Card>
                )}
              >
                <StudentCourseDetail
                  course={selected}
                  studentId={student.id}
                  studentName={student.fullName}
                  onBack={() => setSelected(null)}
                  backLabel="Back to courses"
                />
              </ErrorBoundary>
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
