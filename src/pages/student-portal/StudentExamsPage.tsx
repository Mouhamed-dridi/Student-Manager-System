import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, Timer } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  classNameFor,
  errorMessage,
  listExamsForStudent,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { ExamRecord } from "@/pages/teacher-portal/exams";
import { loadCurrentStudent } from "./currentStudent";
import { dateKeyOf, formatLongDate } from "./scheduleDates";

function ExamCard({ exam }: { exam: ExamRecord }) {
  const details = [exam.type, exam.duration, exam.semester].filter(Boolean);
  return (
    <article className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{exam.title}</h3>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium">
          {exam.duration || "—"}
        </span>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {formatLongDate(exam.date)}
      </p>

      {details.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {details.map((detail) => (
            <span
              key={detail}
              className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            >
              {detail}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 border-t pt-3">
        {exam.attachmentUrl ? (
          <a
            href={exam.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            {exam.attachment || "Download exam file"}
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            No file attached
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Exams for the student's class. `exams` has no program_id, so the query
 * matches the class snapshot written at creation time (program + training).
 */
export default function StudentExamsPage() {
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [exams, setExams] = useState<ExamRecord[]>([]);
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
          setExams([]);
          return;
        }
        // Ensure we have non‑empty program/training strings. If either is missing we fall back to empty strings – the API will treat missing values as a global match.
        const program = record.program?.trim() ?? "";
        const training = record.training?.trim() ?? "";
        setExams(await listExamsForStudent(program, training));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRefetchOnFocus(load);

  const todayKey = dateKeyOf(new Date());

  const { upcoming, past } = useMemo(() => {
    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcoming: sorted.filter((exam) => exam.date >= todayKey),
      past: sorted.filter((exam) => exam.date < todayKey).reverse(),
    };
  }, [exams, todayKey]);

  const classLabel = student
    ? classNameFor(student.program, student.training)
    : "";

  if (student === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Exams</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Exams</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {classLabel || "Your class"} · upcoming and past exams
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          {exams.length} exam{exams.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {loading ? (
        <DataLoading label="Loading exams…" />
      ) : exams.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No exams have been published for your class yet.
        </p>
      ) : (
        <div className="mt-4 space-y-8">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No upcoming exams.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Past
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {past.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
