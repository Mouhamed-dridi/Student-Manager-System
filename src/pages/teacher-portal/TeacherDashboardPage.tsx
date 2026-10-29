import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  Users,
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
  classRosterForTeacher,
  countQuizResponses,
  errorMessage,
  listPlanning,
  listPublications,
  listTeacherQuizzes,
  loadAttendanceRecords,
  subscribeToTable,
  type AttendanceRecord,
  type Quiz,
} from "@/lib/api";
import {
  dashboardWidgetsKey,
  loadWidgetPrefs,
  saveWidgetPrefs,
  widgetStatGridClass,
} from "@/lib/dashboardWidgets";
import { cn } from "@/lib/utils";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type { PlanningRecord } from "@/pages/teacher-portal/planning";
import type { Publication } from "@/pages/publications/publicationTypes";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { loadCurrentTeacher } from "./currentTeacher";
import {
  TEACHER_WIDGETS,
  type TeacherWidgetPrefs,
} from "./teacherDashboardWidgets";

interface TeacherDashboardData {
  courses: TeacherCourseRecord[];
  students: Student[];
  /** Sessions from today onwards, soonest first. */
  planning: PlanningRecord[];
  /** Latest quizzes with their response counts. */
  quizzes: { quiz: Quiz; responses: number }[];
  attendance: AttendanceRecord[];
  announcements: Publication[];
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function latestDate(records: AttendanceRecord[]): string | null {
  // loadAttendanceRecords() already sorts newest first, but a defensive scan
  // keeps this correct if a caller ever hands over an unsorted list.
  let newest: string | null = null;
  for (const record of records) {
    if (!newest || record.date > newest) newest = record.date;
  }
  return newest;
}

export default function TeacherDashboardPage() {
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  // Keyed per teacher record so two teachers sharing a browser keep their own
  // layout (src/lib/dashboardWidgets.ts).
  const [prefs, setPrefs] = useState<TeacherWidgetPrefs | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (record: Teacher) => {
    try {
      setError(null);
      setQuizError(null);
      const [roster, planning, quizzes, attendance, publications] =
        await Promise.all([
          classRosterForTeacher(record.id).catch(() => ({
            courses: [] as TeacherCourseRecord[],
            students: [] as Student[],
          })),
          listPlanning().catch(() => [] as PlanningRecord[]),
          listTeacherQuizzes(record.id).catch((err) => {
            // The quizzes table/columns may not be migrated yet; surface that
            // inside the widget instead of pretending there are no quizzes.
            setQuizError(errorMessage(err));
            return [] as Quiz[];
          }),
          loadAttendanceRecords().catch(() => [] as AttendanceRecord[]),
          listPublications().catch(() => [] as Publication[]),
        ]);

      const recentQuizzes = quizzes.slice(0, 4);
      const counts = await countQuizResponses(
        recentQuizzes.map((quiz) => quiz.id),
      ).catch(() => ({} as Record<string, number>));

      const today = todayIso();
      setData({
        courses: roster.courses,
        students: roster.students,
        planning: planning
          .filter((entry) => entry.teacherId === record.id && entry.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 4),
        quizzes: recentQuizzes.map((quiz) => ({
          quiz,
          responses: counts[quiz.id] ?? 0,
        })),
        attendance: attendance.filter(
          (row) => row.type === "teacher" && row.fullName === record.fullName,
        ),
        announcements: publications
          .filter((pub) => pub.recipients.includes("teachers"))
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
    loadCurrentTeacher()
      .then((record) => {
        if (cancelled) return;
        setTeacher(record);
        if (!record) return;
        // Preferences depend on the teacher id, which only exists after the
        // session record resolves — so they are read here, not in a
        // synchronous effect.
        setPrefs(
          loadWidgetPrefs(
            dashboardWidgetsKey("teacher", record.id),
            TEACHER_WIDGETS,
          ),
        );
        void refresh(record);
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!teacher) return;
    return subscribeToTable("publications", () => void refresh(teacher));
  }, [teacher, refresh]);

  useRefetchOnFocus(() => {
    if (teacher) void refresh(teacher);
  });

  if (teacher === undefined) {
    return <DataLoading label="Loading your dashboard…" />;
  }

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found. It may have been removed by the
        administration.
      </p>
    );
  }

  if (!prefs) {
    return <DataLoading label="Loading your dashboard…" />;
  }

  const firstName =
    teacher.fullName.trim().split(/\s+/)[0] || "Teacher";
  const kpiCount = [
    prefs.classes,
    prefs.students,
    prefs.attendance,
  ].filter(Boolean).length;
  const visibleCount = TEACHER_WIDGETS.filter((w) => prefs[w.id]).length;
  const attendanceCount = data?.attendance.length ?? 0;
  const lastAttendance = latestDate(data?.attendance ?? []);

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
              {prefs.classes && (
                <DashboardWidgetStat
                  icon={BookOpen}
                  label="Assigned Classes"
                  value={String(data.courses.length)}
                  hint="Courses attached to your class"
                />
              )}
              {prefs.students && (
                <DashboardWidgetStat
                  icon={Users}
                  label="Active Students"
                  value={String(data.students.length)}
                  hint="Students matched to your courses"
                />
              )}
              {prefs.attendance && (
                <DashboardWidgetStat
                  icon={CalendarCheck}
                  label="Attendance Tracking"
                  value={String(attendanceCount)}
                  hint={
                    lastAttendance
                      ? `Last entry ${formatDay(lastAttendance)}`
                      : "No entries logged yet"
                  }
                />
              )}
            </div>
          )}

          {(prefs.planning || prefs.quizzes) && (
            <div
              className={cn(
                "grid gap-4",
                prefs.planning && prefs.quizzes && "lg:grid-cols-2",
              )}
            >
              {prefs.planning && (
                <DashboardWidgetCard
                  title="Upcoming Planning / Schedule"
                  subtitle="From today onwards"
                >
                  {data.planning.length === 0 ? (
                    <DashboardWidgetEmpty>
                      No sessions planned for the days ahead.
                    </DashboardWidgetEmpty>
                  ) : (
                    <ul className="divide-y">
                      {data.planning.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between gap-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {entry.course || "Untitled session"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {[entry.className, entry.sessionTime]
                                .filter(Boolean)
                                .join(" · ") || "No class or time set"}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDay(entry.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </DashboardWidgetCard>
              )}

              {prefs.quizzes && (
                <DashboardWidgetCard
                  title="Recent Submissions / Quizzes"
                  subtitle="Answers received per quiz"
                >
                  {quizError ? (
                    <p className="text-sm text-destructive">{quizError}</p>
                  ) : data.quizzes.length === 0 ? (
                    <DashboardWidgetEmpty>
                      No quizzes created yet.
                    </DashboardWidgetEmpty>
                  ) : (
                    <ul className="divide-y">
                      {data.quizzes.map(({ quiz, responses }) => (
                        <li
                          key={quiz.id}
                          className="flex items-start justify-between gap-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {quiz.title || "Untitled quiz"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {quiz.isPublished ? "Published" : "Draft"} ·{" "}
                              {quiz.questions.length} question
                              {quiz.questions.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {responses} response{responses === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </DashboardWidgetCard>
              )}
            </div>
          )}

          {prefs.announcements && (
            <DashboardWidgetCard
              title="Latest Announcements"
              subtitle="Notices sent to teachers"
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
        </>
      )}

      <CustomizeWidgetsDialog
        open={customizeOpen}
        widgets={TEACHER_WIDGETS}
        preferences={prefs}
        onOpenChange={setCustomizeOpen}
        onSave={(next) => {
          setPrefs(next);
          saveWidgetPrefs(dashboardWidgetsKey("teacher", teacher.id), next);
        }}
      />
    </div>
  );
}
