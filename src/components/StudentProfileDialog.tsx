// Teams-style student profile, opened from any student table (the operator's
// Students list and the teacher's My Class roster). It is a dialog rather than
// a route because sections are state, not routes (see AGENTS.md): a click on a
// row must not navigate, it must surface the record in place.
//
// Everything shown here comes from the `Student` record; the Activity tab adds
// the student's attendance log, which is the only per-student history the app
// exposes today (attendance is denormalized by full name, hence the lookup by
// `fullName`). No column is guessed: optional fields simply render "—".

import { useEffect, useState } from "react";
import {
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserAvatar from "@/components/UserAvatar";
import { errorMessage, loadStudentAttendance } from "@/lib/api";
import type { AttendanceRecord } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Student } from "@/pages/students/StudentForm";

interface StudentProfileDialogProps {
  /** The student to show, or null when the dialog is closed. */
  student: Student | null;
  onClose: () => void;
  /** Operator only: opens the edit form. Omitted in the teacher portal. */
  onEdit?: (student: Student) => void;
}

/** A tile in the contact/academic grids. */
function InfoCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{value || "—"}</p>
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

export default function StudentProfileDialog({
  student,
  onClose,
  onEdit,
}: StudentProfileDialogProps) {
  const fullName = student?.fullName ?? "";
  // The load result is tagged with the student it belongs to, so switching
  // records can never flash the previous student's attendance. `null` until
  // this student's fetch settles = still loading.
  const [attendanceResult, setAttendanceResult] = useState<{
    fullName: string;
    rows: AttendanceRecord[];
    error: string | null;
  } | null>(null);

  // The Activity tab's real data: the student's own attendance rows. Loaded
  // once per student, and only while the dialog is open.
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

  const track = [student?.program, student?.training].filter(Boolean).join(" · ");
  const phone = phoneDigits(student?.phone);
  const email = student?.email?.trim() ?? "";
  const socials = SOCIALS.map((social) => ({
    ...social,
    value: student?.[social.key]?.trim() ?? "",
  })).filter((social) => social.value !== "");
  const recent = attendance?.slice(0, 3) ?? [];

  return (
    <Dialog open={student !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        {student && (
          <>
            {/* Header: avatar, name, track tags and the quick actions row. */}
            <div className="border-b bg-gradient-to-br from-primary/10 via-muted/40 to-background px-6 pb-5 pt-6 pr-14">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <UserAvatar
                  name={student.fullName}
                  className="h-20 w-20 border-2 text-2xl"
                />

                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-2xl font-semibold">
                    {student.fullName}
                  </DialogTitle>
                  <DialogDescription className="mt-2 flex flex-wrap items-center gap-2">
                    {student.program && (
                      <span className="rounded-full border bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                        {student.program}
                      </span>
                    )}
                    {student.training && (
                      <span className="rounded-full border bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                        {student.training}
                      </span>
                    )}
                    {email && (
                      <span className="truncate text-xs text-muted-foreground">
                        {email}
                      </span>
                    )}
                  </DialogDescription>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className={buttonVariants({ variant: "default", size: "sm" })}
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </a>
                    )}
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </a>
                    )}
                    {phone && (
                      <a
                        href={`https://wa.me/${phone.replace(/^\+/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </a>
                    )}
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onEdit(student);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit profile
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="gap-0">
              <div className="border-b px-6">
                <TabsList variant="line" className="h-10">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="academic">Academic Info</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>
              </div>

              {/* Overview: the contact grid plus a short about section. */}
              <TabsContent value="overview" className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-xl border bg-card p-4 shadow-sm">
                    <h3 className="text-sm font-semibold">About</h3>
                    <dl className="mt-3 space-y-2 text-sm">
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

                  <section className="rounded-xl border bg-card p-4 shadow-sm">
                    <h3 className="text-sm font-semibold">Recent attendance</h3>
                    {attendance === null && !attendanceError ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Loading…
                      </p>
                    ) : attendanceError ? (
                      <p className="mt-3 text-sm text-destructive">
                        Could not load attendance.
                      </p>
                    ) : recent.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No attendance recorded yet.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {recent.map((record) => (
                          <li
                            key={record.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
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

              <TabsContent value="contact" className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">Social profiles</h3>
                  {socials.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No social profiles added.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
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

              <TabsContent value="academic" className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Courses, exams and grades for this student are recorded by
                  their teachers in the teacher portal.
                </p>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Attendance history</h3>
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
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <p className="text-sm font-medium">No activity yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Attendance appears here once this student is marked
                      present.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y rounded-xl border bg-card shadow-sm">
                    {attendance.map((record) => (
                      <li
                        key={record.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
