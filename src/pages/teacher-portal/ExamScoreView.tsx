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
  classRosterForTeacher,
  errorMessage,
  listGrades,
  saveGradesForExam,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import { useTeacherExams } from "./useTeacherExams";

/**
 * "Exam Score" section: pick one of your exams and fill the grade matrix for
 * the students enrolled in your class.
 */
export default function ExamScoreView() {
  const { teacher, exams, myExams, error, setError } = useTeacherExams();
  const [roster, setRoster] = useState<Student[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // The roster depends on the teacher id, which the hook resolves asynchronously.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    classRosterForTeacher(teacher.id)
      .then(({ students }) => {
        if (cancelled) return;
        setRoster(students);
        setRosterLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setRosterLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [teacher, setError]);

  const selectedExam = myExams.find((e) => e.id === selectedExamId);

  // Prefill the score inputs whenever a different exam is picked.
  const handleExamChange = async (examId: string | null) => {
    setSelectedExamId(examId ?? "");
    const map: Record<string, string> = {};
    if (examId) {
      try {
        setError(null);
        const grades = await listGrades();
        for (const g of grades) {
          if (g.examId === examId) map[g.studentId] = String(g.score);
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    }
    setScores(map);
  };

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || exams === null || !rosterLoaded) {
    return <DataLoading label="Loading grades…" />;
  }

  const handleSaveAll = async () => {
    if (!selectedExam) return;
    // Upsert per (exam, student): blank inputs simply don't re-add a record,
    // so leaving a field empty clears that grade.
    const entries: { studentId: string; score: number }[] = [];
    for (const s of roster) {
      const raw = (scores[s.id] ?? "").trim();
      if (raw === "") continue;
      const score = Number(raw);
      if (!Number.isFinite(score)) continue;
      entries.push({ studentId: s.id, score });
    }
    try {
      setError(null);
      setSaving(true);
      await saveGradesForExam(selectedExam.id, entries);
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
            Pick an exam, then enter each student's score. Blank fields clear the
            grade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedExamId}
            onValueChange={handleExamChange}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select an exam" />
            </SelectTrigger>
            <SelectContent>
              {myExams.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.title}
                  {exam.semester ? ` — ${exam.semester}` : ""} — {exam.date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSaveAll} disabled={!selectedExam || saving}>
            Save Grades
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {error && <DataError message={error} />}
      </div>

      {myExams.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No exams to grade yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an exam on the Create Exam page first, then record grades
              here.
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
            <p className="text-sm font-medium">No students in your class</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Students appear here once they are enrolled in a course you teach.
            </p>
          </CardContent>
        </Card>
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
                {roster.map((s) => {
                  const raw = scores[s.id] ?? "";
                  const invalid =
                    raw.trim() !== "" && !Number.isFinite(Number(raw));
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.fullName}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className={`w-32 ${invalid ? "border-red-500" : ""}`}
                          aria-label={`Score for ${s.fullName}`}
                          value={raw}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [s.id]: e.target.value,
                            }))
                          }
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
