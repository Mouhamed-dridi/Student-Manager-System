// Coursera-style course detail for the student portal: a hero with the title,
// subtitle, instructor and cover image, a metadata badge row (instructor,
// difficulty, duration, format), then the body — skills, overview, syllabus and
// the attached media — with a sticky sidebar and the ratings/review block.
//
// The teacher portal keeps its own simpler CourseDetail; only the shared
// material rendering (components/courseMaterial.tsx) is reused.
//
// Every optional piece of metadata lives in a column the live database may not
// have yet, so the capabilities probe decides what renders. Nothing here is
// allowed to block the rest of the page.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  FileText,
  Film,
  Gauge,
  Layers,
  Paperclip,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CourseReviewsSection from "@/components/CourseReviewsSection";
import UserAvatar from "@/components/UserAvatar";
import { MaterialItem } from "@/components/courseMaterial";
import { formatPublished, thumbnailForTraining } from "@/lib/courseDisplay";
import { courseDetailCapabilities, teacherNamesByIds } from "@/lib/api";
import type { CourseDetailCapabilities } from "@/lib/api";
import type { ScheduledCourseView } from "@/lib/trainings";

// ------------------------------------------------------------- display maps

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  medium: "Medium",
  expert: "Expert",
};

const FORMAT_LABELS: Record<string, string> = {
  video: "Video",
  document: "Document",
  mixed: "Mixed",
};

function levelLabel(value?: string): string | null {
  if (!value) return null;
  return LEVEL_LABELS[value.toLowerCase()] ?? value;
}

function formatLabel(value?: string): string | null {
  if (!value) return null;
  return FORMAT_LABELS[value.toLowerCase()] ?? value;
}

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h". */
function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** The syllabus is one topic per line; bullets and numbering are stripped. */
function syllabusTopics(syllabus?: string): string[] {
  if (!syllabus) return [];
  return syllabus
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•\d.)\]]+\s*/, "").trim())
    .filter(Boolean);
}

function MetaBadge({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

interface StudentCourseDetailProps {
  course: ScheduledCourseView;
  /** The signed-in student, used to stamp new reviews. */
  studentId: string;
  studentName: string;
  onBack: () => void;
  backLabel?: string;
}

export default function StudentCourseDetail({
  course,
  studentId,
  studentName,
  onBack,
  backLabel = "Back to courses",
}: StudentCourseDetailProps) {
  const [capabilities, setCapabilities] = useState<CourseDetailCapabilities | null>(
    null,
  );
  const [instructor, setInstructor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    courseDetailCapabilities()
      .then((caps) => {
        if (!cancelled) setCapabilities(caps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // courses.teacher_id has no foreign key to teachers(id), so the name has to
  // be resolved with its own query rather than a PostgREST embed. The id is
  // stored alongside the name so a course switch can never show the previous
  // course's instructor while the new lookup is in flight.
  useEffect(() => {
    const teacherId = course.teacherId;
    if (!teacherId) return;
    let cancelled = false;
    teacherNamesByIds([teacherId])
      .then((names) => {
        if (cancelled) return;
        const name = names[teacherId];
        setInstructor(name ? { id: teacherId, name } : null);
      })
      .catch(() => {
        if (!cancelled) setInstructor(null);
      });
    return () => {
      cancelled = true;
    };
  }, [course.teacherId]);

  const instructorName =
    instructor && instructor.id === course.teacherId ? instructor.name : null;

  const classLabel =
    [course.training, course.program].filter(Boolean).join(" · ") || null;
  const thumbnail =
    course.thumbnail ?? thumbnailForTraining(course.training ?? "");
  const materials = course.materials ?? [];
  const topics = syllabusTopics(course.syllabus);
  const skills = course.skills ?? [];

  const duration = formatDuration(course.durationMinutes);
  const level = levelLabel(course.level);
  const delivery = formatLabel(course.format);

  // Until the probe answers, assume the columns are missing so nothing renders
  // unverified; the hero itself never depends on it.
  const has = (key: keyof CourseDetailCapabilities) =>
    capabilities?.[key] === true;

  const badges = [
    instructorName
      ? { key: "instructor", icon: <User className="h-3 w-3" />, value: instructorName }
      : null,
    level
      ? { key: "level", icon: <Gauge className="h-3 w-3" />, value: level }
      : null,
    duration
      ? { key: "duration", icon: <Clock className="h-3 w-3" />, value: duration }
      : null,
    delivery
      ? { key: "format", icon: <Film className="h-3 w-3" />, value: delivery }
      : null,
  ].filter(Boolean) as { key: string; icon: ReactNode; value: string }[];

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
        {classLabel ? (
          <span className="text-xs text-muted-foreground">{classLabel}</span>
        ) : null}
      </div>

      {/* ---------------------------------------------------------------- hero */}
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold tracking-tight">
            {course.name}
          </h2>
          {course.subtitle ? (
            <p className="mt-2 text-lg text-muted-foreground">
              {course.subtitle}
            </p>
          ) : null}
          {instructorName ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <UserAvatar name={instructorName} className="h-7 w-7" />
              Taught by{" "}
              <span className="font-medium text-foreground">
                {instructorName}
              </span>
            </p>
          ) : null}
          {badges.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <MetaBadge key={badge.key} icon={badge.icon}>
                  {badge.value}
                </MetaBadge>
              ))}
            </div>
          ) : null}
        </div>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={course.name}
            className="h-48 w-full rounded-xl object-cover lg:h-full lg:max-h-64"
          />
        ) : null}
      </div>

      {/* ---------------------------------------------------------------- body */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-8">
          {has("skills") ? (
            <section>
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                Skills you&rsquo;ll gain
              </h3>
              {skills.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  No skills have been listed for this course yet.
                </p>
              ) : (
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {skills.map((skill) => (
                    <li
                      key={skill}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section>
            <h3 className="text-sm font-medium">Overview</h3>
            {course.description ? (
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {course.description}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                No description has been added for this course yet.
              </p>
            )}
          </section>

          {has("syllabus") ? (
            <section>
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Layers className="h-3.5 w-3.5" />
                Course syllabus
              </h3>
              {topics.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  The syllabus has not been published for this course yet.
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {topics.map((topic, i) => (
                    <li key={`${topic}-${i}`} className="flex gap-3 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed text-muted-foreground">
                        {topic}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Paperclip className="h-3.5 w-3.5" />
              Course media
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
                {materials.map((material, i) => (
                  <MaterialItem
                    key={`${material.name}-${i}`}
                    material={material}
                  />
                ))}
              </div>
            )}
          </section>

          {course.id ? (
            <CourseReviewsSection
              courseId={course.id}
              studentId={studentId}
              studentName={studentName}
              enabled={capabilities?.reviews ?? null}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Reviews are not available for this scheduled course. Only courses
              added by a teacher can be rated.
            </p>
          )}
        </div>

      {/* ------------------------------------------------------------- sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          {instructorName ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Your instructor</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <UserAvatar name={instructorName} className="h-10 w-10 text-sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {instructorName}
                  </p>
                  {course.training ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {course.training}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Course details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {level ? (
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Level</span>
                  <span className="font-medium">{level}</span>
                </p>
              ) : null}
              {duration ? (
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{duration}</span>
                </p>
              ) : null}
              {delivery ? (
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium">{delivery}</span>
                </p>
              ) : null}
              {materials.length > 0 ? (
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Materials</span>
                  <span className="font-medium">{materials.length}</span>
                </p>
              ) : null}
              {course.published ? (
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Published</span>
                  <span className="font-medium">
                    {formatPublished(course.published)}
                  </span>
                </p>
              ) : null}
              {level || duration || delivery || course.published ? null : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  No course details have been published yet.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
