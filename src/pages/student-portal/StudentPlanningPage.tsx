import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataError, DataLoading } from "@/components/DataState";
import { PlanningLocationBadge } from "@/components/PlanningLocationBadge";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  classNameFor,
  errorMessage,
  listExamsForStudent,
  listPlanningForClass,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Student } from "@/pages/students/StudentForm";
import type { ExamRecord } from "@/pages/teacher-portal/exams";
import type {
  PlanningCategory,
  PlanningRecord,
} from "@/pages/teacher-portal/planning";
import {
  planningCategoryFor,
  planningCategoryKey,
  planningSessionTypeKey,
} from "@/pages/teacher-portal/planning";
import { loadCurrentStudent } from "./currentStudent";
import {
  addDays,
  dateKeyOf,
  formatDayLabel,
  formatLongDate,
  formatWeekRange,
  startOfWeek,
} from "./scheduleDates";

interface DayBucket {
  sessions: PlanningRecord[];
  exams: ExamRecord[];
}

type PlanningFilter = "all" | PlanningCategory;

const FILTER_OPTIONS: { value: PlanningFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "course", label: "Courses" },
  { value: "exam", label: "Exams" },
  { value: "pfe", label: "PFE" },
];

function sortSessions(a: PlanningRecord, b: PlanningRecord): number {
  return (
    (a.sessionTime ?? "").localeCompare(b.sessionTime ?? "") ||
    (a.course ?? "").localeCompare(b.course ?? "")
  );
}

/**
 * `planning.date` is a plain "YYYY-MM-DD" (or an ISO timestamp on old rows).
 * Cutting the string keeps the stored calendar day — `new Date("2026-11-23")`
 * would shift a day back in positive timezones.
 */
function storedDateKey(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

function PlanningCategoryPill({ category }: { category: PlanningCategory }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-300 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-zinc-600 uppercase dark:border-zinc-700 dark:text-zinc-400">
      {t(planningCategoryKey(category))}
    </span>
  );
}

/**
 * The student's week: the teacher's planning entries for their class plus any
 * exam scheduled in the same week. Planning rows are filtered by the student's
 * class in api.ts (FK scope, else a normalized class label) and then grouped
 * here by their stored date string.
 */
export default function StudentPlanningPage() {
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  // undefined = still loading; null = the record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [planning, setPlanning] = useState<PlanningRecord[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanningFilter>("all");

  // Promise chain (not async/await) to match MyAttendancePage: every setState
  // lands in a callback, so it never runs synchronously inside the effect.
  const load = useCallback(() => {
    return loadCurrentStudent()
      .then(async (record) => {
        setError(null);
        setStudent(record);
        if (!record) {
          setPlanning([]);
          setExams([]);
          return;
        }
        const classLabel = classNameFor(record.program, record.training);
        const [schedule, classExams] = await Promise.all([
          listPlanningForClass(classLabel, {
            programId: record.programId,
            trainingId: record.trainingId,
          }),
          listExamsForStudent(record.program, record.training),
        ]);
        setPlanning(schedule);
        setExams(classExams);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRefetchOnFocus(load);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (const day of weekDays) {
      map.set(dateKeyOf(day), { sessions: [], exams: [] });
    }
    for (const session of planning) {
      if (filter !== "all" && planningCategoryFor(session.sessionType) !== filter) {
        continue;
      }
      const bucket = map.get(storedDateKey(session.date));
      if (bucket) bucket.sessions.push(session);
    }
    // Scheduled exams come from their own table; they belong to the "exam"
    // filter and to "all", never to Courses/PFE.
    if (filter === "all" || filter === "exam") {
      for (const exam of exams) {
        const bucket = map.get(storedDateKey(exam.date));
        if (bucket) bucket.exams.push(exam);
      }
    }
    for (const bucket of map.values()) {
      bucket.sessions.sort(sortSessions);
      bucket.exams.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [planning, exams, weekDays, filter]);

  const todayKey = dateKeyOf(new Date());
  const weekSessionCount = [...buckets.values()].reduce(
    (total, bucket) => total + bucket.sessions.length + bucket.exams.length,
    0,
  );

  const classLabel = student
    ? classNameFor(student.program, student.training)
    : "";

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold">{t("Planning")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {classLabel || t("Your class")} · {t("Weekly schedule")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("Previous week")}
          onClick={() => setWeekStart((current) => addDays(current, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium">
          {formatWeekRange(weekStart, locale)}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("Next week")}
          onClick={() => setWeekStart((current) => addDays(current, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
        >
          {t("This week")}
        </Button>
      </div>
    </div>
  );

  if (student === null) {
    return (
      <div>
        {header}
        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "Your student record could not be found. It may have been removed by the administration.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      {header}

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {loading ? (
        <DataLoading label={t("Loading your week…")} />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {weekSessionCount === 0
                ? t("Nothing scheduled this week.")
                : weekSessionCount === 1
                  ? t("{count} item this week", { count: weekSessionCount })
                  : t("{count} items this week", { count: weekSessionCount })}
            </p>
            <div
              role="group"
              aria-label={t("Filter by category")}
              className="inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100 p-[3px] dark:border-zinc-800 dark:bg-zinc-900"
            >
              {FILTER_OPTIONS.map((option) => {
                const active = option.value === filter;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                    )}
                  >
                    {t(option.label)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {weekDays.map((day) => {
              const key = dateKeyOf(day);
              const bucket = buckets.get(key) ?? { sessions: [], exams: [] };
              const isToday = key === todayKey;
              return (
                <section
                  key={key}
                  className={cn(
                    "rounded-lg border bg-white p-4 dark:bg-zinc-950",
                    isToday
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-800",
                  )}
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-100">
                      {formatDayLabel(day, locale)}
                    </h3>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatLongDate(key, locale)}
                    </span>
                  </header>

                  {bucket.sessions.length === 0 && bucket.exams.length === 0 ? (
                    <p className="mt-3 rounded-md border border-dashed border-zinc-200 px-2 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      {t("No sessions")}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {bucket.sessions.map((session) => {
                        const category = planningCategoryFor(
                          session.sessionType,
                        );
                        return (
                          <li
                            key={session.id}
                            className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <PlanningCategoryPill category={category} />
                              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                {t(planningSessionTypeKey(session.sessionType))}
                              </span>
                              {session.sessionTime && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {session.sessionTime}
                                </span>
                              )}
                              <PlanningLocationBadge
                                room={session.roomName}
                                sessionType={session.sessionType}
                                monochrome
                              />
                            </div>
                            <p className="mt-1 text-sm font-medium break-words text-zinc-900 dark:text-zinc-100">
                              {session.course || t("Logged session")}
                            </p>
                            {session.content ? (
                              <p className="mt-0.5 text-xs break-words whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                                {session.content}
                              </p>
                            ) : null}
                            {session.materialUrl ? (
                              <a
                                href={session.materialUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="mt-1 inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {session.materialName ||
                                    t("Lesson material")}
                                </span>
                              </a>
                            ) : null}
                          </li>
                        );
                      })}

                      {bucket.exams.map((exam) => (
                        <li
                          key={exam.id}
                          className="rounded-md border border-zinc-300 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            {t("Exam")}
                          </div>
                          <p className="mt-1 text-sm font-medium break-words text-zinc-900 dark:text-zinc-100">
                            {exam.title}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {[exam.type, exam.duration, exam.semester]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {t(
              "Exams appear on their scheduled day and are also listed under Exams.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
