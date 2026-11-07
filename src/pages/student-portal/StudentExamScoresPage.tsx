import { useCallback, useEffect, useState } from "react";
import { Award, GraduationCap } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  classNameFor,
  errorMessage,
  listExamsByIds,
  listStudentGrades,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { ExamRecord } from "@/pages/teacher-portal/exams";
import { loadCurrentStudent } from "./currentStudent";
import { formatLongDate } from "./scheduleDates";

/** 11.5 -> "11.5", 12 -> "12". */
function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : String(Number(score.toFixed(2)));
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface ScoreRow {
  id: string;
  exam: ExamRecord;
  score: number;
}

/**
 * The student's own results: one row per graded exam. Grades are read from
 * `grades` filtered by student_id, then joined to their exams by id (the table
 * has no FK, so PostgREST cannot embed them).
 */
export default function StudentExamScoresPage() {
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [rows, setRows] = useState<ScoreRow[]>([]);
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
          setRows([]);
          return;
        }
        const grades = await listStudentGrades(record.id);
        const exams = await listExamsByIds(grades.map((grade) => grade.examId));
        const byId = new Map(exams.map((exam) => [exam.id, exam]));
        const joined: ScoreRow[] = [];
        for (const grade of grades) {
          const exam = byId.get(grade.examId);
          // A grade whose exam was deleted is skipped rather than rendered empty.
          if (exam) joined.push({ id: grade.id, exam, score: grade.score });
        }
        joined.sort((a, b) => b.exam.date.localeCompare(a.exam.date));
        setRows(joined);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRefetchOnFocus(load);

  const average =
    rows.length > 0
      ? rows.reduce((total, row) => total + row.score, 0) / rows.length
      : 0;
  const best = rows.reduce((top, row) => Math.max(top, row.score), 0);

  const classLabel = student
    ? classNameFor(student.program, student.training)
    : "";

  if (student === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Exam Score</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h2 className="text-2xl font-semibold">Exam Score</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {classLabel || "Your class"} · your graded exams
        </p>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {loading ? (
        <DataLoading label="Loading your scores…" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No grades have been published for you yet.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Average"
              value={`${formatScore(average)} / 20`}
              hint={`${rows.length} graded exam${rows.length === 1 ? "" : "s"}`}
            />
            <Stat label="Best score" value={`${formatScore(best)} / 20`} />
            <Stat
              label="Grade"
              value={average >= 10 ? "Pass" : "Below pass"}
              hint="Pass mark: 10 / 20"
            />
          </div>

          <div className="mt-6 -mx-4 overflow-x-auto rounded-lg border bg-card px-4 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.exam.title}
                      </span>
                    </TableCell>
                    <TableCell>{formatLongDate(row.exam.date)}</TableCell>
                    <TableCell>{row.exam.type || "—"}</TableCell>
                    <TableCell>{row.exam.semester || "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatScore(row.score)} / 20
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Award className="h-3.5 w-3.5" />
            Scores are published by your teacher and cannot be edited here.
          </p>
        </>
      )}
    </div>
  );
}
