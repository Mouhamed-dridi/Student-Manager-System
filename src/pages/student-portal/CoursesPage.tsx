import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";
import { COURSES } from "@/lib/trainings";
import type { ScheduledCourse } from "@/lib/trainings";
import { loadCurrentStudent } from "./currentStudent";

const trainingThumbnails = import.meta.glob(
  "../../assets/img/courses/*.jpg",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as Record<string, string>;

// "Réseaux et sécurité informatique" -> reseaux-et-securite-informatique
// Apostrophes become dashes too: "Comptable d'entreprise" -> comptable-d-entreprise
function trainingSlug(training: string): string {
  return training
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['\u2019\s]+/g, "-");
}

function thumbnailFor(training: string): string | null {
  const suffix = `/${trainingSlug(training)}.jpg`;
  const entry = Object.entries(trainingThumbnails).find(([path]) =>
    path.endsWith(suffix),
  );
  return entry?.[1] ?? null;
}

interface CourseCardProps {
  course: ScheduledCourse;
  training: string;
}

function CourseCard({ course, training }: CourseCardProps) {
  const thumbnail = thumbnailFor(training);

  return (
    <Card className="h-full pt-0">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={training}
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="h-40 w-full bg-muted" />
      )}
      <CardContent>
        <CardTitle>{course.name}</CardTitle>
      </CardContent>
      <CardFooter className="gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {course.day}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {course.time}
        </span>
      </CardFooter>
    </Card>
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.name} course={c} training={student.training} />
          ))}
        </div>
      )}
    </div>
  );
}
