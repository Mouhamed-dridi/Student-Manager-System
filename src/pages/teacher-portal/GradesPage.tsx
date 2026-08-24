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
  listExams,
  listGrades,
  listStudents,
  saveGradesForExam,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { ExamRecord } from "./exams";
import { loadCurrentTeacher } from "./currentTeacher";

export default function GradesPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [exams, setExams] = useState<ExamRecord[] | null>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled || !record) {
          if (!cancelled) setTeacher(record ?? null);
          return;
        }
        setTeacher(record);
        try {
          const [allExams, allStudents] = await Promise.all([
            listExams(),
            listStudents(),
          ]);
          if (cancelled) return;
          setExams(allExams);
          setRoster(
            allStudents.filter(
              (s) =>
                s.program === record.program && s.training === record.training,
            ),
          );
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const myExams: ExamRecord[] = (exams ?? [])
    .filter(
      (e) =>
        e.program === teacher?.program && e.training === teacher?.training,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

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

  if (teacher === undefined || exams === null) {
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
        <h2 className="text-2xl font-semibold">Grades</h2>
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
                  {exam.title} — {exam.date}
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
              Create an exam on the Exams page first, then record grades here.
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
              Students appear here once they are assigned to your program and
              training.
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
