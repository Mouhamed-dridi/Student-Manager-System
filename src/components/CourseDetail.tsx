import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CirclePlay,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPublished, thumbnailForTraining } from "@/lib/courseDisplay";
import type { CourseMaterial, ScheduledCourseView } from "@/lib/trainings";

const VIDEO_EXTENSION = /\.(mp4|m4v|webm|ogv|mov)$/i;
const PDF_EXTENSION = /\.pdf$/i;

// Browsers don't always report a MIME type for a picked file, so the file
// name is checked as well as the stored type.
function materialKind(material: CourseMaterial): "video" | "pdf" | "file" {
  const type = (material.type || "").toLowerCase();
  const name = material.name.toLowerCase();
  if (type.startsWith("video/") || VIDEO_EXTENSION.test(name)) return "video";
  if (type === "application/pdf" || PDF_EXTENSION.test(name)) return "pdf";
  return "file";
}

function materialTypeLabel(type: string): string {
  if (type.startsWith("video/")) return "Video";
  if (type === "application/pdf") return "PDF";
  if (type.includes("word") || type.includes("document")) return "Word document";
  return type || "File";
}

// Course files live in the public 'cours' bucket, so plain public URLs are
// enough — no signed URLs. The HTML download attribute is ignored for
// cross-origin links, so a real download goes through Supabase's
// ?download=<filename> query parameter instead.
function downloadUrlFor(url: string, fileName: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("download", fileName);
    return parsed.toString();
  } catch {
    return url;
  }
}

function MaterialActions({
  material,
}: {
  material: CourseMaterial & { url: string };
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        render={
          <a href={material.url} target="_blank" rel="noreferrer" />
        }
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open
      </Button>
      <Button
        variant="outline"
        size="sm"
        render={
          <a href={downloadUrlFor(material.url, material.name)} />
        }
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  );
}

function MaterialItem({ material }: { material: CourseMaterial }) {
  const kind = materialKind(material);
  const url = material.url;
  const Icon = kind === "video" ? CirclePlay : FileText;
  const attached = typeof url === "string" && url.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{material.name}</span>
        </CardTitle>
        <CardDescription>
          {materialTypeLabel(material.type)}
          {!attached ? " · no file attached" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!attached ? (
          <p className="text-sm text-muted-foreground">
            This material was saved before file uploads were available, so the
            file itself is not available. Ask your teacher to attach it again.
          </p>
        ) : kind === "video" ? (
          <>
            <video
              controls
              preload="metadata"
              src={url}
              className="aspect-video w-full rounded-lg bg-black"
            >
              Your browser cannot play this video.
            </video>
            <MaterialActions material={{ ...material, url }} />
          </>
        ) : kind === "pdf" ? (
          <>
            <iframe
              title={material.name}
              src={url}
              className="h-[70vh] min-h-[480px] w-full rounded-lg border bg-background"
            />
            <MaterialActions material={{ ...material, url }} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This file type cannot be previewed in the browser.
            </p>
            <MaterialActions material={{ ...material, url }} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
  const materials = course.materials ?? [];

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
