// Full-page Teams-style student profile. It replaces the section's content
// (the Students list or the teacher's class roster) rather than opening a modal,
// so the portal header — and its back arrow — stay visible. The holder
// registers the open profile with `useNestedView`, which is what makes the
// header arrow return to the list (see useViewHistory).
//
// Everything on the page comes from the `Student` record. The Activity tab adds
// the student's attendance log, the only per-student history the app exposes
// today (attendance is denormalized by full name, hence the lookup by
// `fullName`). No column is guessed: optional fields simply render "—", and a
// quick action is disabled when the URL it needs is missing.

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  Code2,
  Globe,
  GraduationCap,
  IdCard,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserAvatar from "@/components/UserAvatar";
import { errorMessage, loadStudentAttendance } from "@/lib/api";
import type { AttendanceRecord } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Student } from "@/pages/students/StudentForm";

interface StudentProfilePageProps {
  student: Student;
  /** Back to the list: the page's own button and the header arrow both call it. */
  onBack: () => void;
  /** Label of the in-page back button, e.g. "Back to class" in the teacher portal. */
  backLabel?: string;
  /** Operator only: opens the edit form. Omitted in the teacher portal. */
  onEdit?: (student: Student) => void;
}

/** A tile in the contact/academic grids. */
function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function StatusPill({ blocked }: { blocked?: boolean }) {
  return blocked ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
      <ShieldAlert className="h-3 w-3" />
      Blocked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      <ShieldCheck className="h-3 w-3" />
      Active
    </span>
  );
}

/**
 * Icon-only quick action with a hover/focus tooltip. Rendered as a disabled
 * tile when the record has no value for it, so the header keeps a stable set of
 * actions instead of silently dropping one.
 */
function QuickAction({
  icon: Icon,
  label,
  href,
  external = true,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  external?: boolean;
}) {
  const tip = (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity delay-100 group-hover/action:opacity-100 group-focus-visible/action:opacity-100"
    >
      {label}
    </span>
  );

  if (!href) {
    return (
      <span
        aria-label={`${label} unavailable`}
        aria-disabled="true"
        tabIndex={0}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-lg" }),
          "group/action relative cursor-not-allowed opacity-40",
        )}
      >
        <Icon />
        {tip}
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-label={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-lg" }),
        "group/action relative",
      )}
    >
      <Icon />
      {tip}
    </a>
  );
}

type SocialKey = "facebook" | "instagram" | "whatsapp" | "github" | "linkedin";

const SOCIALS: {
  key: SocialKey;
  label: string;
  icon: LucideIcon;
  prefix: string;
}[] = [
  { key: "facebook", label: "Facebook", icon: Globe, prefix: "https://facebook.com/" },
  { key: "instagram", label: "Instagram", icon: Camera, prefix: "https://instagram.com/" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, prefix: "https://wa.me/" },
  { key: "github", label: "GitHub", icon: Code2, prefix: "https://github.com/" },
  { key: "linkedin", label: "LinkedIn", icon: Briefcase, prefix: "https://linkedin.com/in/" },
];

/** Accepts a full URL or a bare handle, like the student settings form does. */
function socialUrl(key: SocialKey, value: string): string {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (key === "whatsapp") return digits ? `https://wa.me/${digits}` : raw;
  return `${SOCIALS.find((s) => s.key === key)?.prefix ?? ""}${raw.replace(/^@/, "")}`;
}

/** `+212 6 12 34 56 78` → `+212612345678`, which `tel:` and `wa.me` accept. */
function phoneDigits(phone?: string): string {
  return (phone ?? "").replace(/[^\d+]/g, "");
}

export default function StudentProfilePage({
  student,
  onBack,
  backLabel = "Back to students",
  onEdit,
}: StudentProfilePageProps) {
  const fullName = student.fullName;
  // The load result is tagged with the student it belongs to, so switching
  // records can never flash the previous student's attendance. `null` until
  // this student's fetch settles = still loading.
  const [attendanceResult, setAttendanceResult] = useState<{
    fullName: string;
    rows: AttendanceRecord[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!fullName) return;
    let cancelled = false;
    loadStudentAttendance(fullName)
      .then((rows) => {
        if (!cancelled) {
          setAttendanceResult({ fullName, rows, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAttendanceResult({
            fullName,
            rows: [],
            error: errorMessage(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fullName]);

  const current =
    attendanceResult && attendanceResult.fullName === fullName
      ? attendanceResult
      : null;
  const attendance = current?.rows ?? null;
  const attendanceError = current?.error ?? null;

  const track = [student.program, student.training].filter(Boolean).join(" · ");
  const phone = phoneDigits(student.phone);
  const email = student.email?.trim() ?? "";
  const linkedin = student.linkedin?.trim()
    ? socialUrl("linkedin", student.linkedin)
    : "";
  const socials = SOCIALS.map((social) => ({
    ...social,
    value: student[social.key]?.trim() ?? "",
  })).filter((social) => social.value !== "");
  const recent = attendance?.slice(0, 3) ?? [];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onEdit(student)}
          >
            <Pencil className="h-4 w-4" />
            Edit profile
          </Button>
        )}
      </div>

      {/* ----------------------------------------------------------- hero */}
      <section className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-5 bg-gradient-to-br from-primary/10 via-muted/40 to-background px-6 py-7 sm:flex-row sm:items-center md:px-8">
          <UserAvatar
            name={student.fullName}
            className="h-24 w-24 border-2 text-3xl"
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              {student.fullName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {student.program && (
                <span className="rounded-full border bg-background/80 px-2.5 py-0.5 text-xs font-medium">
                  {student.program}
                </span>
              )}
              {student.training && (
                <span className="rounded-full border bg-background/80 px-2.5 py-0.5 text-xs font-medium">
                  {student.training}
                </span>
              )}
              {email && (
                <span className="truncate text-sm text-muted-foreground">
                  {email}
                </span>
              )}
            </div>
          </div>

          {/* Quick actions: WhatsApp / LinkedIn / Email, each with a tooltip. */}
          <div className="flex shrink-0 items-center gap-2">
            <QuickAction
              icon={MessageCircle}
              label="Send WhatsApp"
              href={
                phone
                  ? `https://wa.me/${phone.replace(/^\+/, "")}`
                  : undefined
              }
            />
            <QuickAction
              icon={Briefcase}
              label="View LinkedIn"
              href={linkedin || undefined}
            />
            <QuickAction
              icon={Mail}
              label="Send Email"
              href={email ? `mailto:${email}` : undefined}
              external={false}
            />
          </div>
        </div>

        <Tabs defaultValue="overview" className="gap-0">
          <div className="border-b px-6 md:px-8">
            <TabsList variant="line" className="h-11">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="academic">Academic Info</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview: the contact grid plus a short about section. */}
          <TabsContent value="overview" className="space-y-6 px-6 py-6 md:px-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard icon={Mail} label="Email" value={student.email} />
              <InfoCard icon={Phone} label="Phone" value={student.phone} />
              <InfoCard
                icon={GraduationCap}
                label="Enrolled track"
                value={track}
              />
              <InfoCard
                icon={student.blocked ? ShieldAlert : ShieldCheck}
                label="Status"
                value={student.blocked ? "Blocked" : "Active"}
              />
              <InfoCard icon={MapPin} label="Location" value={student.location} />
              <InfoCard
                icon={BookOpen}
                label="Class"
                value={student.training || "General"}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold">About</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Education</dt>
                    <dd className="text-right font-medium">
                      {student.education || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Age</dt>
                    <dd className="text-right font-medium">
                      {student.age ? `${student.age} years` : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Enrollment</dt>
                    <dd className="text-right font-medium">
                      {student.engagement || "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Account</dt>
                    <dd>
                      <StatusPill blocked={student.blocked} />
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold">Recent attendance</h2>
                {attendance === null && !attendanceError ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Loading…
                  </p>
                ) : attendanceError ? (
                  <p className="mt-4 text-sm text-destructive">
                    Could not load attendance.
                  </p>
                ) : recent.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No attendance recorded yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {recent.map((record) => (
                      <li
                        key={record.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          {record.date}
                        </span>
                        <span className="text-muted-foreground">
                          {record.time || record.className || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6 px-6 py-6 md:px-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard icon={Mail} label="Email" value={student.email} />
              <InfoCard icon={Phone} label="Phone" value={student.phone} />
              <InfoCard icon={MapPin} label="Location" value={student.location} />
              <InfoCard
                icon={GraduationCap}
                label="Enrolled track"
                value={track}
              />
              <InfoCard
                icon={BookOpen}
                label="Class"
                value={student.training || "General"}
              />
              <InfoCard
                icon={CalendarDays}
                label="Enrollment"
                value={student.engagement}
              />
            </div>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Social profiles</h2>
              {socials.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No social profiles added.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {socials.map(({ key, label, icon: Icon, value }) => (
                    <a
                      key={key}
                      href={socialUrl(key, value)}
                      target="_blank"
                      rel="noreferrer"
                      title={value}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="academic" className="space-y-6 px-6 py-6 md:px-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard icon={GraduationCap} label="Program" value={student.program} />
              <InfoCard icon={BookOpen} label="Training" value={student.training} />
              <InfoCard icon={IdCard} label="Education" value={student.education} />
              <InfoCard icon={CalendarDays} label="Enrollment" value={student.engagement} />
              <InfoCard
                icon={student.blocked ? ShieldAlert : ShieldCheck}
                label="Account status"
                value={student.blocked ? "Blocked" : "Active"}
              />
              <InfoCard
                icon={MapPin}
                label="Class"
                value={student.training || "General"}
              />
            </div>

            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Courses, exams and grades for this student are recorded by their
              teachers in the teacher portal.
            </p>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 px-6 py-6 md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Attendance history</h2>
                <p className="text-xs text-muted-foreground">
                  Every check-in logged for this student, newest first.
                </p>
              </div>
              {attendance && attendance.length > 0 && (
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {attendance.length} record
                  {attendance.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {attendance === null && !attendanceError ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : attendanceError ? (
              <p className="text-sm text-destructive">
                Could not load attendance: {attendanceError}
              </p>
            ) : !attendance || attendance.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Attendance appears here once this student is marked present.
                </p>
              </div>
            ) : (
              <ul className="divide-y rounded-xl border bg-card shadow-sm">
                {attendance.map((record) => (
                  <li
                    key={record.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{record.date}</span>
                      {record.time && (
                        <span className="text-muted-foreground">
                          {record.time}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {record.className || record.training || record.program || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
