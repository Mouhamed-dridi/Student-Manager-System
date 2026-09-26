import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Clock, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaterialItem } from "@/components/courseMaterial";
import { formatPublished, thumbnailForTraining } from "@/lib/courseDisplay";
import { toMaterialList } from "@/lib/api";
import type { ScheduledCourseView } from "@/lib/trainings";

interface CourseDetailProps {
  course: ScheduledCourseView;
  onBack: () => void;
  backLabel?: string;
  /** Portal-specific actions, e.g. the teacher's Edit/Delete buttons. */
  actions?: ReactNode;
}

/**
 * Full-page course detail: title, description, and the materials a teacher
 * attached (video played inline, PDFs in a viewer, everything downloadable).
 * Rendered in place of the card grid, with a Back action to return to it.
 */
export default function CourseDetail({
  course,
  onBack,
  backLabel = "Back",
  actions,
}: CourseDetailProps) {
  const classLabel =
    [course.training, course.program].filter(Boolean).join(" · ") || null;
  const thumbnail =
    course.thumbnail ?? thumbnailForTraining(course.training ?? "");
  // courses.materials is jsonb that may arrive as a JSON string (see
  // toMaterialList in lib/api.ts), so it is normalised rather than assumed.
  const materials = toMaterialList(course.materials) ?? [];

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
        {actions}
      </div>

      <h2 className="mt-3 text-2xl font-semibold">{course.name}</h2>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {classLabel ? <span>{classLabel}</span> : null}
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
        {course.published ? (
          <span>Added {formatPublished(course.published)}</span>
        ) : null}
      </div>

      {thumbnail ? (
        <img
          src={thumbnail}
          alt={course.name}
          className="mt-4 max-h-72 w-full rounded-xl object-cover"
        />
      ) : null}

      <section className="mt-6">
        <h3 className="text-sm font-medium">Description</h3>
        {course.description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {course.description}
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">
            No description has been added for this course yet.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="h-3.5 w-3.5" />
          Materials
          <span className="font-normal text-muted-foreground">
            ({materials.length})
          </span>
        </h3>
        {materials.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            No materials have been attached to this course yet.
          </p>
        ) : (
          <div className="mt-2 space-y-4">
            {materials.map((m, i) => (
              <MaterialItem key={`${m.name}-${i}`} material={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
