import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  ExternalLink,
  Hourglass,
} from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import NotificationCallouts from "@/components/NotificationCallouts";
import CustomizeWidgetsDialog from "@/components/dashboard/CustomizeWidgetsDialog";
import {
  DashboardWidgetCard,
  DashboardWidgetEmpty,
  DashboardWidgetStat,
} from "@/components/dashboard/DashboardWidgets";
import PersonalizeDashboardButton from "@/components/dashboard/PersonalizeDashboardButton";
import {
  errorMessage,
  listExams,
  listPayments,
  listPublications,
  loadStudentAttendance,
  subscribeToTable,
  type AttendanceRecord,
} from "@/lib/api";
import {
  dashboardWidgetsKey,
  loadWidgetPrefs,
  saveWidgetPrefs,
  widgetStatGridClass,
} from "@/lib/dashboardWidgets";
import { loadScheduledCourses } from "@/lib/trainings";
import type { CourseMaterial, ScheduledCourseView } from "@/lib/trainings";
import { cn } from "@/lib/utils";
import type { ExamRecord } from "@/pages/teacher-portal/exams";
import type { Payment } from "@/pages/pay/PaymentForm";
import type { Publication } from "@/pages/publications/publicationTypes";
import type { Student } from "@/pages/students/StudentForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { loadCurrentStudent } from "./currentStudent";
import {
  STUDENT_WIDGETS,
  type StudentWidgetPrefs,
} from "./studentDashboardWidgets";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

interface StudentMaterial {
  courseName: string;
  material: CourseMaterial;
}

interface UpcomingItem {
  key: string;
  title: string;
  detail: string;
  date: string;
}

interface StudentDashboardData {
  courses: ScheduledCourseView[];
  materials: StudentMaterial[];
  pendingPayments: Payment[];
  attendance: AttendanceRecord[];
  upcoming: UpcomingItem[];
  announcements: Publication[];
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function norm(value: string | undefined | null): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/** The next scheduled course from today onwards (falls back to the first). */
function nextUpcoming(
  courses: ScheduledCourseView[],
  today: Date,
): ScheduledCourseView | null {
  if (courses.length === 0) return null;
  const todayIdx = (today.getDay() + 6) % 7; // Monday = 0
  const nowSlot = `${String(today.getHours()).padStart(2, "0")}:${String(
    today.getMinutes(),
  ).padStart(2, "0")}`;
  const upcoming = courses.find((course) => {
    const dayIdx = DAY_ORDER.indexOf(course.day ?? "");
    if (dayIdx < todayIdx) return false;
    if (dayIdx > todayIdx) return true;
    const start = ((course.time ?? "").split(/[–-]/)[0] ?? "").trim();
    return !start || start >= nowSlot;
  });
  return upcoming ?? courses[0];
}

export default function StudentDashboardPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [data, setData] = useState<StudentDashboardData | null>(null);
  // Keyed per student record so two students sharing a browser keep their own
  // layout (src/lib/dashboardWidgets.ts).
  const [prefs, setPrefs] = useState<StudentWidgetPrefs | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (record: Student) => {
    try {
      setError(null);
      const [payments, attendance, scheduled, publications, allExams] =
        await Promise.all([
          listPayments().catch(() => [] as Payment[]),
          loadStudentAttendance(record.fullName).catch(
            () => [] as AttendanceRecord[],
          ),
          loadScheduledCourses(record.program, record.training, {
            programId: record.programId,
            trainingId: record.trainingId,
          }).catch(() => [] as ScheduledCourseView[]),
          listPublications().catch(() => [] as Publication[]),
          listExams().catch(() => [] as ExamRecord[]),
        ]);

      const today = todayIso();
      const exams = allExams
        .filter((exam) => exam.date >= today)
        .filter((exam) => {
          const program = norm(exam.program);
          const training = norm(exam.training);
          // An exam with no class snapshots targets everyone.
          if (!program && !training) return true;
          return (
            program === norm(record.program) &&
            training === norm(record.training)
          );
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3)
        .map<UpcomingItem>((exam) => ({
          key: `exam-${exam.id}`,
          title: exam.title || "Untitled exam",
          detail: [exam.type, exam.duration].filter(Boolean).join(" · ") || "Exam",
          date: exam.date,
        }));

      const materials = scheduled.flatMap((course) =>
        (course.materials ?? []).map((material) => ({
          courseName: course.name,
          material,
        })),
      );

      setData({
        courses: scheduled,
        materials,
        pendingPayments: payments.filter(
          (payment) =>
            payment.studentId === record.id && payment.status === "pending",
        ),
        attendance,
        upcoming: exams,
        announcements: publications
          .filter((pub) => pub.recipients.includes("students"))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          ),
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then((record) => {
        if (cancelled) return;
        setStudent(record);
        if (!record) return;
        // Preferences depend on the student id, which only exists after the
        // session record resolves — so they are read here, not in a
        // synchronous effect.
        setPrefs(
          loadWidgetPrefs(
            dashboardWidgetsKey("student", record.id),
            STUDENT_WIDGETS,
          ),
        );
        void refresh(record);
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!student) return;
    return subscribeToTable("courses", () => void refresh(student));
  }, [student, refresh]);

  useRefetchOnFocus(() => {
    if (student) void refresh(student);
  });

  if (student === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your student record could not be found. It may have been removed by the
        administration.
      </p>
    );
  }

  if (student === undefined || !prefs) {
    return <DataLoading label="Loading your dashboard…" />;
  }

  const firstName = student.fullName.trim().split(/\s+/)[0] || "Student";
  const kpiCount = [prefs.courses, prefs.payments, prefs.attendance].filter(
    Boolean,
  ).length;
  const visibleCount = STUDENT_WIDGETS.filter((w) => prefs[w.id]).length;
  const sortedCourses = (data?.courses ?? [])
    .slice()
    .sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day ?? "") - DAY_ORDER.indexOf(b.day ?? "") ||
        (a.time ?? "").localeCompare(b.time ?? ""),
    );
  const nextCourse = nextUpcoming(sortedCourses, new Date());
  const pendingTotal = (data?.pendingPayments ?? []).reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );
  const lastAttendance = (data?.attendance ?? [])[0]?.date;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Welcome back, {firstName}</h2>
        <PersonalizeDashboardButton onClick={() => setCustomizeOpen(true)} />
      </div>

      <NotificationCallouts publications={data?.announcements ?? []} />

      {error && <DataError message={error} />}

      {!data ? (
        !error && <DataLoading label="Loading your dashboard…" />
      ) : visibleCount === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          All widgets are hidden. Use{" "}
          <span className="font-medium text-foreground">
            Personalize your dashboard
          </span>{" "}
          to bring some back.
        </p>
      ) : (
        <>
          {kpiCount > 0 && (
            <div className={cn("grid gap-4", widgetStatGridClass(kpiCount))}>
              {prefs.courses && (
                <DashboardWidgetStat
                  icon={BookOpen}
                  label="Enrolled Courses"
                  value={String(data.courses.length)}
                  hint={
                    nextCourse
                      ? `Next: ${nextCourse.name}${
                          nextCourse.day && nextCourse.time
                            ? ` · ${nextCourse.day} ${nextCourse.time}`
                            : ""
                        }`
                      : "No courses scheduled yet"
                  }
                />
              )}
              {prefs.payments && (
                <DashboardWidgetStat
                  icon={Hourglass}
                  label="Pending Payments"
                  value={String(data.pendingPayments.length)}
                  hint={
                    data.pendingPayments.length > 0
                      ? `${formatCurrency(pendingTotal)} outstanding`
                      : "Nothing outstanding"
                  }
                />
              )}
              {prefs.attendance && (
                <DashboardWidgetStat
                  icon={CalendarCheck}
                  label="Attendance Record"
                  value={String(data.attendance.length)}
                  hint={
                    lastAttendance
                      ? `Last entry ${formatDate(lastAttendance)}`
                      : "No entries logged yet"
                  }
                />
              )}
            </div>
          )}

          {(prefs.exams || prefs.announcements) && (
            <div
              className={cn(
                "grid gap-4",
                prefs.exams && prefs.announcements && "lg:grid-cols-2",
              )}
            >
              {prefs.exams && (
                <DashboardWidgetCard
                  title="Upcoming Exams"
                  subtitle="Exams ahead for your class"
                >
                  {data.upcoming.length === 0 ? (
                    <DashboardWidgetEmpty>
                      Nothing scheduled. You are all caught up.
                    </DashboardWidgetEmpty>
                  ) : (
                    <ul className="divide-y">
                      {data.upcoming.map((item) => (
                        <li
                          key={item.key}
                          className="flex items-start justify-between gap-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {item.date ? formatDate(item.date) : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </DashboardWidgetCard>
              )}

              {prefs.announcements && (
                <DashboardWidgetCard
                  title="Recent Announcements"
                  subtitle="Notices sent to students"
                >
                  {data.announcements.length === 0 ? (
                    <DashboardWidgetEmpty>
                      No announcements yet.
                    </DashboardWidgetEmpty>
                  ) : (
                    <ul className="divide-y">
                      {data.announcements.slice(0, 3).map((pub) => (
                        <li key={pub.id} className="py-2">
                          <p className="text-sm font-medium">{pub.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {pub.createdAt
                              ? new Date(pub.createdAt).toLocaleDateString()
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </DashboardWidgetCard>
              )}
            </div>
          )}

          {prefs.materials && (
            <DashboardWidgetCard
              title="Course Materials Quick Access"
              subtitle={
                data.materials.length === 0
                  ? "Files attached to your courses"
                  : `${data.materials.length} file${
                      data.materials.length === 1 ? "" : "s"
                    } across your courses`
              }
            >
              {data.materials.length === 0 ? (
                <DashboardWidgetEmpty>
                  No course materials have been attached yet.
                </DashboardWidgetEmpty>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.materials.map(({ courseName, material }, index) => (
                    <li
                      key={`${courseName}-${material.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {material.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {courseName}
                          {material.type ? ` · ${material.type}` : ""}
                        </p>
                      </div>
                      {material.url ? (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </DashboardWidgetCard>
          )}
        </>
      )}

      <CustomizeWidgetsDialog
        open={customizeOpen}
        widgets={STUDENT_WIDGETS}
        preferences={prefs}
        onOpenChange={setCustomizeOpen}
        onSave={(next) => {
          setPrefs(next);
          saveWidgetPrefs(dashboardWidgetsKey("student", student.id), next);
        }}
      />
    </div>
  );
}
