// Full-page Teams-style teacher profile, mounted by the operator's Teachers
// section when a row is clicked. It uses the exact same shell, hero, quick
// actions, info cards and tab bar as StudentProfilePage (see ProfileParts), so
// the two people views cannot drift apart.
//
// Teachers have no bio/office-hour/LinkedIn columns in the current schema, so
// those read as "—"/disabled instead of guessing. Everything else is real:
// `classRosterForTeacher` supplies the assigned courses + students, `planning`
// the weekly schedule, and `publications` the teacher announcements.

import { useEffect, useState } from "react";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Clock,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-regular-svg-icons";
import {
  ProfileInfoCard,
  ProfilePageShell,
  ProfileQuickAction,
  ProfileStatusPill,
} from "@/components/ProfileParts";
import {
  classRosterForTeacher,
  errorMessage,
  listPlanning,
  listPublications,
} from "@/lib/api";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type { Publication } from "@/pages/publications/publicationTypes";
import { NOTIFICATION_TYPE_LABELS } from "@/pages/publications/publicationTypes";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { PlanningRecord } from "@/pages/teacher-portal/planning";

interface TeacherProfilePageProps {
  teacher: Teacher;
  /** Back to the list: the page's own button and the header arrow both call it. */
  onBack: () => void;
  backLabel?: string;
  /** Operator only: opens the edit form. */
  onEdit?: (teacher: Teacher) => void;
}

interface TeacherProfileData {
  teacherId: string;
  courses: TeacherCourseRecord[];
  students: Student[];
  planning: PlanningRecord[];
  announcements: Publication[];
  errors: {
    courses: string | null;
    schedule: string | null;
    announcements: string | null;
  };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
});
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Monday-based week, matching the teacher portal's Planning page. */
function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

/** `+212 6 12 34 56 78` → `+212612345678`, which `tel:` and `wa.me` accept. */
function phoneDigits(phone?: string): string {
  return (phone ?? "").replace(/[^\d+]/g, "");
}

/** Same class-matching rule as classRosterForTeacher. */
function studentsInCourse(
  course: TeacherCourseRecord,
  students: Student[],
): number {
  return students.filter((student) => {
    if (
      course.programId &&
      course.trainingId &&
      student.programId &&
      student.trainingId
    ) {
      return (
        student.programId === course.programId &&
        student.trainingId === course.trainingId
      );
    }
    return (
      student.program === course.program &&
      student.training === course.training
    );
  }).length;
}

function publicationDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

export default function TeacherProfilePage({
  teacher,
  onBack,
  backLabel = "Back to teachers",
  onEdit,
}: TeacherProfilePageProps) {
  const [data, setData] = useState<TeacherProfileData | null>(null);

  // Loaded once per teacher. The result is tagged with the teacher id so a
  // realtime refresh of the list can never show another teacher's courses.
  useEffect(() => {
    const teacherId = teacher.id;
    let cancelled = false;

    (async () => {
      const [rosterResult, planningResult, publicationsResult] =
        await Promise.allSettled([
          classRosterForTeacher(teacherId),
          listPlanning(),
          listPublications(),
        ]);
      if (cancelled) return;

      let coursesError: string | null = null;
      let scheduleError: string | null = null;
      let announcementsError: string | null = null;

      const roster =
        rosterResult.status === "fulfilled"
          ? rosterResult.value
          : { courses: [] as TeacherCourseRecord[], students: [] as Student[] };
      if (rosterResult.status === "rejected") {
        coursesError = errorMessage(rosterResult.reason);
      }

      const planning =
        planningResult.status === "fulfilled" ? planningResult.value : [];
      if (planningResult.status === "rejected") {
        scheduleError = errorMessage(planningResult.reason);
      }

      const publications =
        publicationsResult.status === "fulfilled"
          ? publicationsResult.value
          : [];
      if (publicationsResult.status === "rejected") {
        announcementsError = errorMessage(publicationsResult.reason);
      }

      setData({
        teacherId,
        courses: roster.courses,
        students: roster.students,
        planning: planning.filter((entry) => entry.teacherId === teacherId),
        announcements: publications
          .filter((publication) => publication.recipients.includes("teachers"))
          .slice(0, 5),
        errors: {
          courses: coursesError,
          schedule: scheduleError,
          announcements: announcementsError,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [teacher.id]);

  const current = data && data.teacherId === teacher.id ? data : null;
  const loading = current === null;
  const courses = current?.courses ?? [];
  const students = current?.students ?? [];
  const planning = current?.planning ?? [];
  const announcements = current?.announcements ?? [];
  const errors = current?.errors;

  const email = teacher.email?.trim() ?? "";
  const phone = phoneDigits(teacher.phone);
  const track = [teacher.program, teacher.training].filter(Boolean).join(" · ");

  const weekStart = startOfWeek(new Date());
  const weekDays = WEEKDAYS.map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const key = dateKeyOf(date);
    return {
      key,
      label,
      date,
      entries: planning
        .filter((entry) => entry.date === key)
        .sort((a, b) =>
          (a.sessionTime ?? "").localeCompare(b.sessionTime ?? ""),
        ),
    };
  });
  const weekEnd = weekDays[weekDays.length - 1].date;
  const weekLabel = `${DAY_FORMAT.format(weekStart)} – ${DAY_FORMAT.format(
    weekEnd,
  )}, ${weekEnd.getFullYear()}`;

  const bioLead = [teacher.jobTitle, teacher.company && `at ${teacher.company}`]
    .filter(Boolean)
    .join(" ");
  const bio = bioLead
    ? `${bioLead}.${teacher.education ? ` Education: ${teacher.education}.` : ""}`
    : "";

  return (
    <ProfilePageShell
      name={teacher.fullName}
      badges={[teacher.specialty, teacher.program, teacher.training]}
      subtitle={email || undefined}
      backLabel={backLabel}
      onBack={onBack}
      editAction={
        onEdit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(teacher)}
          >
            <Pencil className="h-4 w-4" />
            Edit profile
          </Button>
        ) : undefined
      }
      actions={
        <>
          <ProfileQuickAction
            icon={<FontAwesomeIcon icon={faWhatsapp} />}
            label="Send WhatsApp"
            disabled={!phone}
            onClick={() =>
              window.open(
                `https://wa.me/${phone.replace(/^\+/, "")}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          />
          <ProfileQuickAction
            icon={<FontAwesomeIcon icon={faLinkedin} />}
            label="View LinkedIn"
            disabled
          />
          <ProfileQuickAction
            icon={<FontAwesomeIcon icon={faEnvelope} />}
            label="Send Email"
            disabled={!email}
            onClick={() => {
              window.location.href = `mailto:${email}`;
            }}
          />
        </>
      }
    >
      <Tabs defaultValue="overview" className="gap-0">
        <div className="border-b px-6 md:px-8">
          <TabsList variant="line" className="h-11">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="courses">Assigned Courses</TabsTrigger>
            <TabsTrigger value="activity">Activity / Schedule</TabsTrigger>
          </TabsList>
        </div>

        {/* --------------------------------------------------------- overview */}
        <TabsContent value="overview" className="space-y-6 px-6 py-6 md:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileInfoCard
              icon={Briefcase}
              label="Department"
              value={teacher.specialty}
            />
            <ProfileInfoCard
              icon={GraduationCap}
              label="Title"
              value={teacher.jobTitle}
            />
            <ProfileInfoCard
              icon={Clock}
              label="Office hours"
              value={undefined}
            />
            <ProfileInfoCard
              icon={BookOpen}
              label="Assigned courses"
              value={loading ? "…" : courses.length}
            />
            <ProfileInfoCard
              icon={Users}
              label="Assigned students"
              value={loading ? "…" : students.length}
            />
            <ProfileInfoCard
              icon={teacher.blocked ? ShieldAlert : ShieldCheck}
              label="Status"
              value={teacher.blocked ? "Blocked" : "Active"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">About</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="text-right font-medium">
                    {teacher.specialty || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Title</dt>
                  <dd className="text-right font-medium">
                    {teacher.jobTitle || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Company</dt>
                  <dd className="text-right font-medium">
                    {teacher.company || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Education</dt>
                  <dd className="text-right font-medium">
                    {teacher.education || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Office hours</dt>
                  <dd className="text-right font-medium">—</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Account</dt>
                  <dd>
                    <ProfileStatusPill blocked={teacher.blocked} />
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Bio</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {bio || "No bio on file yet."}
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Class</dt>
                  <dd className="text-right font-medium">{track || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="text-right font-medium">
                    {teacher.location || "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- contact */}
        <TabsContent value="contact" className="space-y-6 px-6 py-6 md:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileInfoCard icon={Mail} label="Email" value={teacher.email} />
            <ProfileInfoCard icon={Phone} label="Phone" value={teacher.phone} />
            <ProfileInfoCard
              icon={MapPin}
              label="Office location"
              value={teacher.location}
            />
            <ProfileInfoCard
              icon={Briefcase}
              label="Department"
              value={teacher.specialty}
            />
            <ProfileInfoCard
              icon={GraduationCap}
              label="Program"
              value={teacher.program}
            />
            <ProfileInfoCard icon={BookOpen} label="Training" value={teacher.training} />
          </div>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Professional</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Title</dt>
                <dd className="text-right font-medium">
                  {teacher.jobTitle || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Company</dt>
                <dd className="text-right font-medium">
                  {teacher.company || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Education</dt>
                <dd className="text-right font-medium">
                  {teacher.education || "—"}
                </dd>
              </div>
            </dl>
          </section>
        </TabsContent>

        {/* ------------------------------------------------- assigned courses */}
        <TabsContent value="courses" className="space-y-4 px-6 py-6 md:px-8">
          {errors?.courses ? (
            <p className="text-sm text-destructive">
              Could not load courses: {errors.courses}
            </p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading courses…</p>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="text-sm font-medium">No courses assigned</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This teacher has not created any courses yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {courses.map((course) => (
                <article
                  key={course.id}
                  className="rounded-xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {course.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[course.program, course.training]
                          .filter(Boolean)
                          .join(" · ") || "General"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
                      {course.published ? "Published" : "Draft"}
                    </span>
                  </div>

                  {course.subtitle && (
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                      {course.subtitle}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {studentsInCourse(course, students)} student
                      {studentsInCourse(course, students) === 1 ? "" : "s"}
                    </span>
                    {course.duration && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {course.duration}
                      </span>
                    )}
                    {course.level && (
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {course.level}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------- activity/schedule */}
        <TabsContent value="activity" className="space-y-6 px-6 py-6 md:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Weekly schedule</h2>
                <span className="text-xs text-muted-foreground">
                  {weekLabel}
                </span>
              </div>

              {errors?.schedule ? (
                <p className="mt-4 text-sm text-destructive">
                  Could not load the schedule: {errors.schedule}
                </p>
              ) : loading ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Loading schedule…
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {weekDays.map((day) => (
                    <div
                      key={day.key}
                      className="rounded-lg border bg-background/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {day.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {DAY_FORMAT.format(day.date)}
                        </span>
                      </div>
                      {day.entries.length === 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          No sessions
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1.5">
                          {day.entries.map((entry) => (
                            <li
                              key={entry.id}
                              className="flex flex-wrap items-baseline gap-x-2 text-sm"
                            >
                              {entry.sessionTime && (
                                <span className="font-medium">
                                  {entry.sessionTime}
                                </span>
                              )}
                              <span>{entry.course || "Session"}</span>
                              {entry.className && (
                                <span className="text-xs text-muted-foreground">
                                  · {entry.className}
                                </span>
                              )}
                              {entry.content && (
                                <span className="w-full truncate text-xs text-muted-foreground">
                                  {entry.content}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Recent announcements</h2>
              {errors?.announcements ? (
                <p className="mt-4 text-sm text-destructive">
                  Could not load announcements.
                </p>
              ) : loading ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
              ) : announcements.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No announcements for teachers yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {announcements.map((publication) => (
                    <li
                      key={publication.id}
                      className="rounded-lg border bg-background/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{publication.title}</p>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {NOTIFICATION_TYPE_LABELS[publication.type]}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {publication.message}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {publicationDate(publication.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </ProfilePageShell>
  );
}
