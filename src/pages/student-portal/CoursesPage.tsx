import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage } from "@/lib/api";
import { loadScheduledCourses } from "@/lib/trainings";
import type { ScheduledCourseView } from "@/lib/trainings";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

export default function CoursesPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled || !record) {
          if (!cancelled) setStudent(record ?? null);
          return;
        }
        setStudent(record);
        try {
          const list = await loadScheduledCourses(record.program, record.training);
          if (!cancelled) setCourses(list);
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
              <CourseCardsGrid courses={courses} training={student.training} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
