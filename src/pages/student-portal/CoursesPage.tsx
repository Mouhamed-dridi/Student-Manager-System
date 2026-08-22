import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";
import { COURSES } from "@/lib/trainings";
import type { ScheduledCourse } from "@/lib/trainings";
import { loadCurrentStudent } from "./currentStudent";

function CourseRow({ course }: { course: ScheduledCourse }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <span className="text-sm font-medium">{course.name}</span>
      <span className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {course.day}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {course.time}
        </span>
      </span>
    </div>
  );
}

export default function CoursesPage() {
  const [student] = useState(loadCurrentStudent);

  if (!student) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Courses</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  const courses: ScheduledCourse[] =
    COURSES[student.program]?.[student.training] ?? [];

  return (
    <div>
      <h2 className="text-2xl font-semibold">Courses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Assigned to {student.training || "—"} ({student.program})
      </p>

      {courses.length === 0 ? (
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
        <div className="mt-4 max-w-xl space-y-2">
          {courses.map((c) => (
            <CourseRow key={c.name} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
