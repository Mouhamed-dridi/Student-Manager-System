import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  errorMessage,
  listGradesForExam,
  saveGradesForExam,
  teacherExamClasses,
  type TeacherExamClass,
} from "@/lib/api";
import { classIdForExam, classOptionLabel } from "./exams";
import type { ExamRecord } from "./exams";
import { useTeacherExams } from "./useTeacherExams";

/**
 * One exam's score matrix as it is being edited. The draft is tagged with the
 * exam it belongs to, so switching branch or exam can never carry a stale edit
 * (or a half-typed score) over to another exam: a draft whose id no longer
 * matches the active exam is simply not rendered, and the load effect replaces
 * it with the live rows.
 */
interface ScoreDraft {
  examId: string;
  values: Record<string, string>;
  /** Set when the read of that exam's scores failed. */
  error?: string;
}

/**
 * "Exam Score" section: the teacher picks a branch first, then one of that
 * branch's exams. Both the exam list and the roster of students come from the
 * branch, and the scores of the active exam are read as soon as it is known —
 * so the matrix is gradeable without any extra manual step.
 *
 * Branches are `teacherExamClasses()` — `branch_materials` with the `planning`
 * fallback and canonical subject matching, the same source "My Class" and
 * "Create Exam" use — so a teacher staffed in CAP, BTP and BTS ERP/SAP sees all
 * three branches instead of one profile-level class.
 */
export default function ExamScoreView() {
  const { teacher, myExams, error, setError } = useTeacherExams();
  // null = the assignment lookup is still running; [] = no staffed branch.
  const [classes, setClasses] = useState<TeacherExamClass[] | null>(null);
  const [branchChoice, setBranchChoice] = useState("");
  const [examChoice, setExamChoice] = useState("");
  const [draft, setDraft] = useState<ScoreDraft | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Assigned branches, resolved once per teacher: no selection is required to
  // get the first branch, so the page opens on it instead of on an empty form.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    teacherExamClasses(teacher.id, teacher.fullName)
      .then((list) => {
        if (cancelled) return;
        setClasses(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setClasses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teacher, setError]);

  // The default branch is derived, not state: the first assigned branch wins
  // until the teacher picks another one (and a branch that disappeared from the
  // assignment list falls back instead of showing an empty table).
  const branchId =
    branchChoice && (classes ?? []).some((entry) => entry.id === branchChoice)
      ? branchChoice
      : ((classes ?? [])[0]?.id ?? "");
  const branch = (classes ?? []).find((entry) => entry.id === branchId) ?? null;

  // An exam belongs to the branch its class resolves to. Legacy exams with no
  // class scope (created before `exams.branch_id`) match no branch, so they
  // stay listed in every branch rather than becoming impossible to grade.
  const examBranchId = (exam: ExamRecord) =>
    classIdForExam(exam, classes ?? []);
  const branchExams = myExams.filter((exam) => {
    const id = examBranchId(exam);
    return id === "" || id === branchId;
  });

  // First exam of the branch by default — the newest one, since myExams is
  // sorted by date descending.
  const selectedExam =
    branchExams.find((exam) => exam.id === examChoice) ?? branchExams[0] ?? null;
  const selectedExamId = selectedExam?.id ?? "";

  // Roster of the branch the active exam belongs to (the branch itself for a
  // legacy exam with no class scope).
  const examBranch = selectedExam
    ? ((classes ?? []).find((entry) => entry.id === examBranchId(selectedExam)) ??
      null)
    : null;
  const roster = (examBranch ?? branch)?.students ?? [];

  const draftReady = draft !== null && draft.examId === selectedExamId;
  const loadingScores = selectedExamId !== "" && !draftReady;
  const scores = draftReady ? draft.values : {};

  // Read the active exam's scores. Keyed on the exam id, so picking another
  // exam inside the same branch (or switching branch to an exam already
  // selected) refetches exactly that exam's rows.
  useEffect(() => {
    if (!selectedExamId) return;
    let cancelled = false;
    listGradesForExam(selectedExamId)
      .then((grades) => {
        if (cancelled) return;
        const values: Record<string, string> = {};
        for (const grade of grades) {
          values[grade.studentId] = String(grade.score);
        }
        setDraft({ examId: selectedExamId, values });
      })
      .catch((err) => {
        if (cancelled) return;
        setDraft({
          examId: selectedExamId,
          values: {},
          error: errorMessage(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedExamId]);

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || classes === null) {
    return <DataLoading label="Loading grades…" />;
  }

  const setScore = (studentId: string, value: string) => {
    if (!selectedExamId) return;
    setDraft((prev) =>
      prev && prev.examId === selectedExamId
        ? { ...prev, values: { ...prev.values, [studentId]: value } }
        : { examId: selectedExamId, values: { [studentId]: value } },
    );
  };

  const handleBranchChange = (next: string | null) => {
    setBranchChoice(next ?? "");
    // The branch's first exam is selected for it, so an exam of the previous
    // branch is never graded against this branch's roster. The previous
    // branch's draft needs no clearing here: a draft is only ever rendered for
    // the exam id it was loaded for (`draftReady`).
    setExamChoice("");
  };

  const handleExamChange = (next: string | null) => {
    setExamChoice(next ?? "");
  };

  const handleSaveAll = async () => {
    if (!selectedExam) return;
    // Blank inputs are left out of the payload, so saving drops that grade.
    const entries: { studentId: string; score: number }[] = [];
    for (const student of roster) {
      const raw = (scores[student.id] ?? "").trim();
      if (raw === "") continue;
      const score = Number(raw);
      if (!Number.isFinite(score)) continue;
      entries.push({ studentId: student.id, score });
    }
    const rosterIds = roster.map((student) => student.id);
    try {
      setError(null);
      setSaving(true);
      await saveGradesForExam(selectedExam.id, entries, rosterIds);
      // Reload instead of trusting the local draft: the matrix then shows what
      // the database actually holds for this exam.
      const grades = await listGradesForExam(selectedExam.id);
      const values: Record<string, string> = {};
      for (const grade of grades) {
        values[grade.studentId] = String(grade.score);
      }
      setDraft({ examId: selectedExam.id, values });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Exam Score</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a branch, then one of its exams. The branch's students and
            their scores load automatically. Blank fields clear the grade.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Class / Branch
            </span>
            <Select
              value={branchId}
              // No branch/exam switch while a save is in flight: the reload
              // below must land on the exam that was actually written.
              disabled={saving}
              items={classes.map((entry) => ({
                value: entry.id,
                label: classOptionLabel(entry),
              }))}
              onValueChange={handleBranchChange}
            >
              <SelectTrigger className="w-56" aria-label="Class / Branch">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {classOptionLabel(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Exam
            </span>
            <Select
              value={selectedExamId}
              disabled={saving}
              items={branchExams.map((exam) => ({
                value: exam.id,
                label: `${exam.title}${exam.semester ? ` — ${exam.semester}` : ""} — ${exam.date}`,
              }))}
              onValueChange={handleExamChange}
            >
              <SelectTrigger className="w-64" aria-label="Exam">
                <SelectValue placeholder="Select an exam" />
              </SelectTrigger>
              <SelectContent>
                {branchExams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.title}
                    {exam.semester ? ` — ${exam.semester}` : ""} — {exam.date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSaveAll}
            // A failed score read leaves the matrix empty; saving then would
            // wipe the roster's grades, so it stays blocked until a reload
            // succeeds.
            disabled={!selectedExam || saving || loadingScores || Boolean(draft?.error)}
          >
            Save Grades
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {error && <DataError message={error} />}
      </div>

      {classes.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No branch assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You are not staffed in a class yet, so there are no exams to grade.
              Ask the administration to assign you to a branch.
            </p>
          </CardContent>
        </Card>
      ) : branchExams.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No exams for this branch</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an exam for this branch on the Create Exam page, then record
              its grades here.
            </p>
          </CardContent>
        </Card>
      ) : !selectedExam ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Pick an exam above to enter or review its grades.
        </p>
      ) : roster.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No students in this branch</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Students appear here once they are enrolled in this branch.
            </p>
          </CardContent>
        </Card>
      ) : loadingScores ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading scores…</p>
      ) : draft?.error ? (
        <div className="mt-4 max-w-xl">
          <DataError message={draft.error} />
        </div>
      ) : (
        <>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            Free numeric scores — leave a field empty to clear that grade.
            {justSaved && (
              <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </p>
          <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((student) => {
                  const raw = scores[student.id] ?? "";
                  const invalid =
                    raw.trim() !== "" && !Number.isFinite(Number(raw));
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.fullName}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className={`w-32 ${invalid ? "border-red-500" : ""}`}
                          aria-label={`Score for ${student.fullName}`}
                          value={raw}
                          onChange={(e) => setScore(student.id, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
