import { useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Clock, FileText, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import type { ScheduledCourseView } from "@/lib/trainings";

const trainingThumbnails = import.meta.glob("../assets/img/courses/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

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

function formatPublished(published: string): string {
  return new Date(published).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function materialTypeLabel(type: string): string {
  if (type.startsWith("video/")) return "Video";
  if (type === "application/pdf") return "PDF";
  if (type.includes("word") || type.includes("document")) return "Word document";
  return type || "File";
}

interface CourseCardProps {
  course: ScheduledCourseView;
  training: string;
  actions?: ReactNode;
  onOpenMaterials?: (course: ScheduledCourseView) => void;
}

function CourseCard({
  course,
  training,
  actions,
  onOpenMaterials,
}: CourseCardProps) {
  const thumbnail = course.thumbnail ?? thumbnailFor(training);
  const materialCount = course.materials?.length ?? 0;

  return (
    <Card className="h-full pt-0">
      <div className="relative">
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
        {actions ? (
          <div className="absolute right-2 top-2 flex gap-1">{actions}</div>
        ) : null}
      </div>
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
        {materialCount > 0 && onOpenMaterials ? (
          <button
            type="button"
            onClick={() => onOpenMaterials(course)}
            className="-my-0.5 flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Paperclip className="h-3 w-3" />
            {materialCount} material{materialCount === 1 ? "" : "s"}
          </button>
        ) : null}
        {course.published ? (
          <span className="ml-auto">Added {formatPublished(course.published)}</span>
        ) : null}
      </CardFooter>
    </Card>
  );
}

interface CourseCardsGridProps {
  courses: ScheduledCourseView[];
  training: string;
  renderActions?: (course: ScheduledCourseView) => ReactNode;
  showMaterials?: boolean;
}

export default function CourseCardsGrid({
  courses,
  training,
  renderActions,
  showMaterials = false,
}: CourseCardsGridProps) {
  const [materialsCourse, setMaterialsCourse] =
    useState<ScheduledCourseView | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => (
          <CourseCard
            key={c.id ?? `${c.name}-${c.day}-${c.time}`}
            course={c}
            training={training}
            actions={renderActions?.(c)}
            onOpenMaterials={
              showMaterials ? (course) => setMaterialsCourse(course) : undefined
            }
          />
        ))}
      </div>

      <Dialog
        open={materialsCourse !== null}
        onOpenChange={(open) => !open && setMaterialsCourse(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Course Materials</DialogTitle>
            <DialogDescription>{materialsCourse?.name}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5">
            {materialsCourse?.materials?.map((m, i) => (
              <li
                key={`${m.name}-${i}`}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{m.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {materialTypeLabel(m.type)}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialsCourse(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
