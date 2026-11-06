import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CalendarDays, FileText } from "lucide-react";
import { faChevronLeft, faChevronRight, faClock } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { DataError, DataLoading } from "@/components/DataState";
import { PlanningLocationBadge } from "@/components/PlanningLocationBadge";
import { PlanningSessionTypeBadge } from "@/components/PlanningSessionTypeBadge";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { subjectTone } from "@/lib/subjectColors";
import {
  classNameFor,
  errorMessage,
  listExamsForStudent,
  listPlanningForClass,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { ExamRecord } from "@/pages/teacher-portal/exams";
import type { PlanningRecord } from "@/pages/teacher-portal/planning";
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

function sortSessions(a: PlanningRecord, b: PlanningRecord): number {
  return (
    (a.sessionTime ?? "").localeCompare(b.sessionTime ?? "") ||
    (a.course ?? "").localeCompare(b.course ?? "")
  );
}

/**
 * The student's week: the teacher's planning entries for their class plus any
 * exam scheduled in the same week. Both lists are filtered in the database by
 * the student's class (program + training); planning matches the class FKs and
 * falls back to the class label on databases without them.
 */
export default function StudentPlanningPage() {
  // undefined = still loading; null = the record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [planning, setPlanning] = useState<PlanningRecord[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // Scoped by the student's class FKs when the planning table carries
          // them, else by the class label (pre-migration databases).
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
      const bucket = map.get(session.date?.slice(0, 10));
      if (bucket) bucket.sessions.push(session);
    }
    for (const exam of exams) {
      const bucket = map.get(exam.date?.slice(0, 10));
      if (bucket) bucket.exams.push(exam);
    }
    for (const bucket of map.values()) {
      bucket.sessions.sort(sortSessions);
      bucket.exams.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [planning, exams, weekDays]);

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
      <div>
        <h2 className="text-2xl font-semibold">Planning</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {classLabel || "Your class"} · weekly schedule
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={() => setWeekStart((current) => addDays(current, -7))}
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-sm" />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium">
          {formatWeekRange(weekStart)}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next week"
          onClick={() => setWeekStart((current) => addDays(current, 7))}
        >
          <FontAwesomeIcon icon={faChevronRight} className="text-sm" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
        >
          This week
        </Button>
      </div>
    </div>
  );

  if (student === null) {
    return (
      <div>
        {header}
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
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
        <DataLoading label="Loading your week…" />
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {weekSessionCount === 0
              ? "Nothing scheduled this week."
              : `${weekSessionCount} item${weekSessionCount === 1 ? "" : "s"} this week`}
          </p>

          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {weekDays.map((day) => {
              const key = dateKeyOf(day);
              const bucket = buckets.get(key) ?? { sessions: [], exams: [] };
              const isToday = key === todayKey;
              return (
                <section
                  key={key}
                  className={`rounded-lg border bg-card p-4 ${
                    isToday ? "border-foreground" : ""
                  }`}
                >
                  <header className="flex items-baseline justify-between border-b pb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                      {formatDayLabel(day)}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {formatLongDate(key)}
                    </span>
                  </header>

                  {bucket.sessions.length === 0 && bucket.exams.length === 0 ? (
                    <p className="pt-3 text-xs text-muted-foreground">
                      No sessions.
                    </p>
                  ) : (
                    <ul className="space-y-2 pt-3">
                      {bucket.sessions.map((session) => {
                        const tone = subjectTone(session.course);
                        return (
                          <li
                            key={session.id}
                            className={`rounded-md border border-l-4 bg-background p-2.5 ${tone.border}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                                />
                                <span className="truncate">
                                  {session.course || "Session"}
                                </span>
                              </span>
                              <PlanningSessionTypeBadge
                                sessionType={session.sessionType}
                              />
                              {session.sessionTime && (
                                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                                  <FontAwesomeIcon
                                    icon={faClock}
                                    className="text-[11px]"
                                  />
                                  {session.sessionTime}
                                </span>
                              )}
                              <PlanningLocationBadge
                                room={session.roomName}
                                sessionType={session.sessionType}
                              />
                            </div>
                            {session.content && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {session.content}
                              </p>
                            )}
                          </li>
                        );
                      })}

                      {bucket.exams.map((exam) => (
                        <li
                          key={exam.id}
                          className="rounded-md border border-foreground/30 bg-foreground p-2.5 text-background"
                        >
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest">
                              Exam
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium">{exam.title}</p>
                          <p className="mt-0.5 text-xs opacity-80">
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
            <CalendarDays className="h-3.5 w-3.5" />
            Exams appear on their scheduled day and are also listed under Exams.
          </p>
        </>
      )}
    </div>
  );
}
