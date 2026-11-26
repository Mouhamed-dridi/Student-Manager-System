import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Filter, GraduationCap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  listExamsForStudentScores,
  listStudentGrades,
  type StudentExamEntry,
} from "@/lib/api";
import { subjectAliasKey, subjectNamesMatch } from "@/lib/courseDisplay";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Student } from "@/pages/students/StudentForm";
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
  exam: StudentExamEntry;
  score: number;
}

/**
 * The student's own results: one row per graded exam. Grades are read from
 * `grades` filtered by student_id, then joined to their exams by id (the table
 * has no FK, so PostgREST cannot embed them).
 *
 * The matière filter is the same one the Exams page offers: "All subjects" is
 * pinned first with the total, then every matière of the class (the branch
 * `branch_materials` catalog merged with the exam subjects, alias-deduped) with
 * the number of scores it holds — including the ones still at 0.
 */
export default function StudentExamScoresPage() {
  const { t } = useI18n();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  // The class's matières, branch catalog + distinct exam subjects.
  const [materials, setMaterials] = useState<string[]>([]);
  // Alias-folded matière key; "all" shows every score.
  const [subject, setSubject] = useState<string>("all");
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
          setMaterials([]);
          return;
        }
        const grades = await listStudentGrades(record.id);
        const feed = await listExamsForStudentScores(
          grades.map((grade) => grade.examId),
          {
            program: record.program?.trim() ?? "",
            training: record.training?.trim() ?? "",
            programId: record.programId,
            trainingId: record.trainingId,
          },
        );
        setMaterials(feed.materials);
        const byId = new Map(feed.exams.map((exam) => [exam.id, exam]));
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

  // A matière that disappears (material deleted, class changed) must not leave
  // the page stuck on an empty filter; derive the active key during render.
  const activeSubject = materials.some(
    (name) => subjectAliasKey(name) === subject,
  )
    ? subject
    : "all";

  const subjectOptions = useMemo(() => {
    return [
      { value: "all", label: t("All subjects"), count: rows.length },
      ...materials.map((name) => ({
        value: subjectAliasKey(name),
        label: name,
        count: rows.filter((row) =>
          row.exam.materials.some((material) =>
            subjectNamesMatch(material, name),
          ),
        ).length,
      })),
    ];
  }, [rows, materials, t]);

  const selectItems = useMemo(
    () => subjectOptions.map(({ value, label }) => ({ value, label })),
    [subjectOptions],
  );

  const filteredRows = useMemo(() => {
    if (activeSubject === "all") return rows;
    return rows.filter((row) =>
      row.exam.materials.some((material) =>
        subjectNamesMatch(material, activeSubject),
      ),
    );
  }, [rows, activeSubject]);

  const average =
    filteredRows.length > 0
      ? filteredRows.reduce((total, row) => total + row.score, 0) /
        filteredRows.length
      : 0;
  const best = filteredRows.reduce((top, row) => Math.max(top, row.score), 0);

  const classLabel = student
    ? classNameFor(student.program, student.training)
    : "";

  const activeSubjectLabel =
    subjectOptions.find((option) => option.value === activeSubject)?.label ??
    "";

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Exam Score</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {classLabel || "Your class"} · your graded exams
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Award className="h-4 w-4" />
            {filteredRows.length} score{filteredRows.length === 1 ? "" : "s"}
          </span>

          {/* Matière filter — same control as the Exams page, beside the
              counter and opening downward so it never overlaps the top navbar.
              Every class material is listed, with 0 for the ones that have no
              grade yet. */}
          {materials.length > 0 && (
            <Select
              value={activeSubject}
              items={selectItems}
              onValueChange={(value) => setSubject(value ?? "all")}
            >
              <SelectTrigger
                aria-label={t("Filter by subject")}
                className="h-9 max-w-[18rem] gap-2 border-zinc-200 bg-zinc-50 px-3 text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <Filter className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="shrink-0 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {t("Subjects")}
                </span>
                <SelectValue className="min-w-0 truncate font-medium" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="end"
                sideOffset={8}
                className="z-50 max-h-[320px] min-w-[240px] overflow-y-auto border border-zinc-200 bg-white shadow-sm ring-0 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {subjectOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="gap-2 py-1.5 text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:text-zinc-100"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                        option.count === 0
                          ? "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                          : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                      )}
                    >
                      {option.count}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
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
      ) : filteredRows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No scores published for {activeSubjectLabel} yet.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Average"
              value={`${formatScore(average)} / 20`}
              hint={`${filteredRows.length} graded exam${
                filteredRows.length === 1 ? "" : "s"
              }`}
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
                {filteredRows.map((row) => (
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
