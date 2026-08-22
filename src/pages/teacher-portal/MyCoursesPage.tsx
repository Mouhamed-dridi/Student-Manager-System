import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import { COURSES } from "@/lib/trainings";
import type { ScheduledCourse } from "@/lib/trainings";
import { loadCurrentTeacher } from "./currentTeacher";

export default function MyCoursesPage() {
  const [teacher] = useState(loadCurrentTeacher);

  if (!teacher) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">My Courses</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your teacher record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  const courses: ScheduledCourse[] =
    COURSES[teacher.program]?.[teacher.training] ?? [];

  return (
    <div>
      <h2 className="text-2xl font-semibold">My Courses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Teaching {teacher.training || "—"} ({teacher.program})
      </p>

      {courses.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No courses scheduled yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing has been planned for your program and training so far.
              Please check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4">
          <CourseCardsGrid courses={courses} training={teacher.training} />
        </div>
      )}
    </div>
  );
}
