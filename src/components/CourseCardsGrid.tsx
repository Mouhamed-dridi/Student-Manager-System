import type { ReactNode } from "react";
import { CalendarDays, Clock, Paperclip, User } from "lucide-react";
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
import { useT } from "@/lib/i18n";
import type { ScheduledCourseView } from "@/lib/trainings";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: ScheduledCourseView;
  training?: string;
  actions?: ReactNode;
  onOpen?: () => void;
  /** Optional teacher name to display on the card footer. */
  teacherName?: string;
}

function CourseCard({ course, training, actions, onOpen, teacherName }: CourseCardProps) {
  const t = useT();
  const thumbnail =
    course.thumbnail?.trim() ||
    thumbnailForTraining(course.training ?? training ?? "");
  // A JSON-string materials value would make `.length` report the string's
  // character count instead of the number of attachments.
  const materialCount = (Array.isArray(course.materials)
    ? course.materials
    : []
  ).length;
  const className = course.training ?? training ?? "";

  return (
    <Card
      className={cn(
        "group h-full gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950",
        onOpen &&
          "relative transition-shadow hover:ring-2 hover:ring-zinc-400/40 focus-within:ring-2 focus-within:ring-zinc-400/40 dark:hover:ring-zinc-600/50 dark:focus-within:ring-zinc-600/50",
      )}
    >
      {/* Fixed 16/10 cover keeps every card in a row the same height; the
          subtle zoom is hover polish only (the overlay button covers it). */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={className}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div aria-hidden="true" className="h-full w-full bg-zinc-100 dark:bg-zinc-900" />
        )}
        {actions ? (
          <div className="absolute right-2 top-2 z-20 flex gap-1">{actions}</div>
        ) : null}
      </div>
      <CardContent className="flex-1 p-4">
        <CardTitle>{course.name}</CardTitle>
        {course.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="mt-auto flex-wrap gap-x-4 gap-y-1 border-t border-zinc-200/80 bg-zinc-50/60 px-4 py-3 text-xs text-muted-foreground dark:border-zinc-800/80 dark:bg-zinc-900/40">
        {teacherName ? (
          <span className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            {teacherName}
          </span>
        ) : null}
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
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <Paperclip className="h-3 w-3" />
            {materialCount === 1
              ? t("1 material")
              : t("{count} materials", { count: materialCount })}
          </span>
        ) : null}
        {course.published ? (
          <span className="ml-auto inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {t("Added {date}", { date: formatPublished(course.published) })}
          </span>
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
          aria-label={t("Open {name}", { name: course.name })}
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
  /** Map of teacherId → teacher name, used to display the author on each card. */
  teacherNameMap?: Map<string, string>;
}

export default function CourseCardsGrid({
  courses,
  training,
  renderActions,
  onOpenCourse,
  teacherNameMap,
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
          teacherName={c.teacherId ? teacherNameMap?.get(c.teacherId) : undefined}
        />
      ))}
    </div>
  );
}
