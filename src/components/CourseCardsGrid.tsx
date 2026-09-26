import type { ReactNode } from "react";
import { CalendarDays, Clock, Paperclip } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  courseKey,
  formatPublished,
  thumbnailForTraining,
} from "@/lib/courseDisplay";
import type { ScheduledCourseView } from "@/lib/trainings";

interface CourseCardProps {
  course: ScheduledCourseView;
  training?: string;
  actions?: ReactNode;
  onOpen?: () => void;
}

function CourseCard({ course, training, actions, onOpen }: CourseCardProps) {
  const thumbnail =
    course.thumbnail ?? thumbnailForTraining(course.training ?? training ?? "");
  // A JSON-string materials value would make `.length` report the string's
  // character count instead of the number of attachments.
  const materialCount = (Array.isArray(course.materials)
    ? course.materials
    : []
  ).length;
  const className = course.training ?? training ?? "";

  return (
    <Card
      className={
        onOpen
          ? "relative h-full pt-0 transition-shadow hover:ring-foreground/25 focus-within:ring-3 focus-within:ring-ring/50"
          : "h-full pt-0"
      }
    >
      <div className="relative">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={className}
            loading="lazy"
            className="h-40 w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="h-40 w-full bg-muted" />
        )}
        {actions ? (
          <div className="absolute right-2 top-2 z-20 flex gap-1">{actions}</div>
        ) : null}
      </div>
      <CardContent>
        <CardTitle>{course.name}</CardTitle>
        {course.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="gap-4 text-xs text-muted-foreground">
        {course.day ? (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {course.day}
          </span>
        ) : null}
        {course.time ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {course.time}
          </span>
        ) : null}
        {materialCount > 0 ? (
          <span className="flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {materialCount} material{materialCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {course.published ? (
          <span className="ml-auto">Added {formatPublished(course.published)}</span>
        ) : null}
      </CardFooter>
      {/*
        Cover button above the whole card (below the z-20 action buttons) so
        every part of it is clickable without nesting those buttons inside a
        <button>, which would be invalid HTML.
      */}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${course.name}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none"
        />
      ) : null}
    </Card>
  );
}

interface CourseCardsGridProps {
  courses: ScheduledCourseView[];
  training?: string;
  renderActions?: (course: ScheduledCourseView) => ReactNode;
  /** Omit to render a read-only grid (e.g. an empty preview). */
  onOpenCourse?: (course: ScheduledCourseView) => void;
}

export default function CourseCardsGrid({
  courses,
  training,
  renderActions,
  onOpenCourse,
}: CourseCardsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((c) => (
        <CourseCard
          key={courseKey(c)}
          course={c}
          training={training}
          actions={renderActions?.(c)}
          onOpen={onOpenCourse ? () => onOpenCourse(c) : undefined}
        />
      ))}
    </div>
  );
}
