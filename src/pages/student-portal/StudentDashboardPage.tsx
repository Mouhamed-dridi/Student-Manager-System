import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, CalendarX, Hourglass, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listPayments,
  listPublications,
  loadStudentAttendance,
} from "@/lib/api";
import { loadScheduledCourses } from "@/lib/trainings";
import type { ScheduledCourseView } from "@/lib/trainings";
import type { Publication } from "@/pages/publications/PublicationsPage";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function nextUpcoming(
  courses: ScheduledCourseView[],
  today: Date,
): ScheduledCourseView | null {
  if (courses.length === 0) return null;
  const todayIdx = (today.getDay() + 6) % 7; // Monday = 0
  const nowSlot = `${String(today.getHours()).padStart(2, "0")}:${String(
    today.getMinutes(),
  ).padStart(2, "0")}`;
  const upcoming = courses.find((c) => {
    const dayIdx = DAY_ORDER.indexOf(c.day);
    if (dayIdx < todayIdx) return false;
    if (dayIdx > todayIdx) return true;
    const start = (c.time.split(/[–-]/)[0] ?? "").trim();
    return !start || start >= nowSlot;
  });
  return upcoming ?? courses[0];
}

interface StudentStats {
  pending: number;
  absences: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function StudentDashboardPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  const [announcements, setAnnouncements] = useState<Publication[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled || !record) {
          if (!cancelled) setStudent(record ?? null);
          return;
        }
        setStudent(record);
        try {
          const [payments, attendance, scheduled, pubs] = await Promise.all([
            listPayments(),
            loadStudentAttendance(record.fullName),
            loadScheduledCourses(record.program, record.training, {
              programId: record.programId,
              trainingId: record.trainingId,
            }).catch(() => []),
            listPublications().catch(() => []),
          ]);
          if (cancelled) return;
          const mine = payments.filter((p) => p.studentId === record.id);
          setStats({
            pending: mine.filter((p) => p.status === "pending").length,
            absences: attendance.length,
          });
          setCourses(scheduled);
          setAnnouncements(
            pubs
              .filter((p) => p.recipients.includes("students"))
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .slice(0, 3),
          );
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (student === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your student record could not be found. It may have been removed by the
        administration.
      </p>
    );
  }

  if (student === undefined) {
    return <DataLoading label="Loading your dashboard…" />;
  }

  const firstName = student.fullName.trim().split(/\s+/)[0] || "Student";
  const weekCourses = (courses ?? [])
    .slice()
    .sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
        a.time.localeCompare(b.time),
    );
  const latestCourse = nextUpcoming(weekCourses, new Date());

  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome back, {firstName}! You are assigned to{" "}
        {student.training || "—"} ({student.program}).
      </p>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {stats === null ? (
        !error && <DataLoading label="Loading your dashboard…" />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={BookOpen}
            label="Latest Course"
            value={
              latestCourse ? (
                <>
                  <span className="block truncate">{latestCourse.name}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {latestCourse.day} · {latestCourse.time}
                  </span>
                </>
              ) : (
                "No courses yet"
              )
            }
          />
          <StatCard
            icon={Hourglass}
            label="Pending Payments"
            value={String(stats.pending)}
          />
          <StatCard
            icon={CalendarX}
            label="Absence Records"
            value={String(stats.absences)}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This Week's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {courses === null ? (
              <DataLoading label="Loading schedule…" />
            ) : weekCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No courses scheduled for your program and training yet.
              </p>
            ) : (
              <ul className="divide-y">
                {weekCourses.map((c, i) => (
                  <li
                    key={c.id ?? `${c.name}-${c.day}-${i}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.day} · {c.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements === null ? (
              <DataLoading label="Loading announcements…" />
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No announcements yet.
              </p>
            ) : (
              <ul className="divide-y">
                {announcements.map((p) => (
                  <li key={p.id} className="py-2">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString()
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}