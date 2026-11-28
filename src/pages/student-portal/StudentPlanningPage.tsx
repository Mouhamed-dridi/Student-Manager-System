import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataError, DataLoading } from "@/components/DataState";
import { PlanningLocationBadge } from "@/components/PlanningLocationBadge";
import { PlanningMeetingLink } from "@/components/PlanningMeetingLink";
import { PlanningSessionTypeBadge } from "@/components/PlanningSessionTypeBadge";
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
} from "@/pages/teacher-portal/planning";
import { loadCurrentStudent } from "./currentStudent";
import {
  addDays,
  dateKeyOf,
  formatLongDate,
  formatWeekRange,
  startOfWeek,
  storedDateKey,
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

/**
 * The student agenda runs Monday–Saturday: Sunday is a day off, so it is not
 * rendered at all (no column, no date header, no day in the week range).
 */
const AGENDA_DAYS = 6;

function sortSessions(a: PlanningRecord, b: PlanningRecord): number {
  return (
    (a.sessionTime ?? "").localeCompare(b.sessionTime ?? "") ||
    (a.course ?? "").localeCompare(b.course ?? "")
  );
}

/** "lun."/"Mon" → "LUN"/"MON": short, dot-free weekday abbreviation. */
function weekdayAbbr(date: Date, locale: string): string {
  return date
    .toLocaleDateString(locale, { weekday: "short" })
    .replace(/\.$/, "");
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
 * Read-only session sheet opened from an agenda card. It deliberately has no
 * edit/delete action: the student portal never mutates planning rows.
 */
function SessionDetailDialog({
  session,
  onClose,
}: {
  session: PlanningRecord | null;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  if (!session) return null;
  const category = planningCategoryFor(session.sessionType);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <PlanningCategoryPill category={category} />
            <PlanningSessionTypeBadge
              sessionType={session.sessionType}
              label={session.customSessionType}
            />
          </div>
          <DialogTitle className="mt-1 text-lg leading-snug break-words">
            {session.course || t("Logged session")}
          </DialogTitle>
          <DialogDescription>
            {formatLongDate(storedDateKey(session.date), locale)}
            {session.sessionTime ? ` · ${session.sessionTime}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <PlanningLocationBadge
              room={session.roomName}
              sessionType={session.sessionType}
              monochrome
            />
            {session.className ? (
              <span className="inline-flex min-w-0 items-center rounded-full border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                <span className="truncate">{session.className}</span>
              </span>
            ) : null}
            <PlanningMeetingLink url={session.meetingUrl} monochrome />
          </div>

          <div>
            <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              {t("Description")}
            </p>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {session.content || t("No description provided.")}
            </p>
          </div>

          {session.materialUrl ? (
            <a
              href={session.materialUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {session.materialName || t("Lesson material")}
              </span>
            </a>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [detail, setDetail] = useState<PlanningRecord | null>(null);

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
        // The schedule is the point of this page: a failing exams query (e.g. a
        // missing optional column) must not blank the student's week, so the two
        // reads settle independently and only the schedule can fail the page.
        const [schedule, classExams] = await Promise.allSettled([
          listPlanningForClass(classLabel, {
            programId: record.programId,
            trainingId: record.trainingId,
          }),
          listExamsForStudent(record.program, record.training),
        ]);
        if (schedule.status === "rejected") throw schedule.reason;
        setPlanning(schedule.value);
        setExams(classExams.status === "fulfilled" ? classExams.value : []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRefetchOnFocus(load);

  const weekDays = useMemo(
    () => Array.from({ length: AGENDA_DAYS }, (_, index) => addDays(weekStart, index)),
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
          {formatWeekRange(weekStart, locale, AGENDA_DAYS)}
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

          {planning.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {classLabel
                ? t("No sessions have been logged for your class yet.")
                : t(
                    "Your class is not linked to a program and training yet, so no sessions can be matched. Ask the administration to complete your record.",
                  )}
            </p>
          ) : null}

          {/* Notion-style agenda: one column per working day, hairline dividers
              produced by the gap over a bordered container. */}
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-6">
              {weekDays.map((day) => {
                const key = dateKeyOf(day);
                const bucket = buckets.get(key) ?? { sessions: [], exams: [] };
                const isToday = key === todayKey;
                const isEmpty =
                  bucket.sessions.length === 0 && bucket.exams.length === 0;
                return (
                  <section
                    key={key}
                    aria-label={formatLongDate(key, locale)}
                    className={cn(
                      "flex min-w-0 flex-col bg-white dark:bg-zinc-950",
                      isToday && "bg-zinc-50 dark:bg-zinc-900/60",
                    )}
                  >
                    <header className="flex items-center justify-between gap-2 border-b border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          {weekdayAbbr(day, locale)}
                        </span>
                        <span
                          className={cn(
                            "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                            isToday
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "text-zinc-900 dark:text-zinc-100",
                          )}
                        >
                          {day.getDate()}
                        </span>
                      </div>
                      {isToday ? (
                        <span className="truncate text-[9px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          {t("Today")}
                        </span>
                      ) : null}
                    </header>

                    <div className="flex min-h-28 flex-1 flex-col gap-1.5 p-1.5 lg:min-h-40">
                      {isEmpty ? (
                        <p className="flex flex-1 items-center justify-center rounded-md border border-dashed border-zinc-200 px-2 py-3 text-center text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                          {t("No sessions")}
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {bucket.sessions.map((session) => {
                            const category = planningCategoryFor(
                              session.sessionType,
                            );
                            return (
                              <li
                                key={session.id}
                                className="overflow-hidden rounded-md border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                              >
                                {/* The Teams link lives outside the button: an
                                    anchor cannot be nested in a button. */}
                                <button
                                  type="button"
                                  onClick={() => setDetail(session)}
                                  className="block w-full min-w-0 p-2 text-left"
                                >
                                  <span className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-semibold text-zinc-500 tabular-nums dark:text-zinc-400">
                                      {session.sessionTime ?? ""}
                                    </span>
                                    <PlanningCategoryPill category={category} />
                                  </span>
                                  <span className="mt-1 block text-xs leading-snug font-medium break-words text-zinc-900 dark:text-zinc-100">
                                    {session.course || t("Logged session")}
                                  </span>
                                  <span className="mt-1 flex flex-wrap items-center gap-1">
                                    <PlanningSessionTypeBadge
                                      sessionType={session.sessionType}
                                      label={session.customSessionType}
                                    />
                                    <PlanningLocationBadge
                                      room={session.roomName}
                                      sessionType={session.sessionType}
                                      monochrome
                                    />
                                  </span>
                                </button>
                                {session.meetingUrl ? (
                                  <div className="border-t border-zinc-100 px-2 py-1 dark:border-zinc-800">
                                    <PlanningMeetingLink
                                      url={session.meetingUrl}
                                      monochrome
                                    />
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}

                          {bucket.exams.map((exam) => (
                            <li
                              key={exam.id}
                              className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900/60"
                            >
                              <span className="flex items-center justify-between gap-1">
                                <PlanningCategoryPill category="exam" />
                                <FileText
                                  aria-hidden="true"
                                  className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500"
                                />
                              </span>
                              <p className="mt-1 text-xs leading-snug font-medium break-words text-zinc-900 dark:text-zinc-100">
                                {exam.title}
                              </p>
                              <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                                {[exam.type, exam.duration, exam.semester]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {t(
              "Exams appear on their scheduled day and are also listed under Exams.",
            )}
          </p>
        </>
      )}

      <SessionDetailDialog session={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
