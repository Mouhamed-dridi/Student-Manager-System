import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  countGradesForExam,
  deleteExamCascade,
  errorMessage,
  listExams,
  upsertExam,
} from "@/lib/api";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { ExamRecord } from "./exams";
import { loadCurrentTeacher } from "./currentTeacher";

const TYPE_OPTIONS = ["TD", "TP", "EXAM PRINCIPAL", "DS"];
const DURATION_OPTIONS = ["30 min", "1h", "1.5h", "2h"];
const OTHER_OPTION = "__other";

function splitChoice(value: string | undefined, options: string[]) {
  if (value && !options.includes(value)) {
    return { choice: OTHER_OPTION, custom: value };
  }
  return { choice: value ?? "", custom: "" };
}

interface ExamFormData {
  id: string;
  title: string;
  date: string;
  type?: string;
  duration?: string;
  attachment?: string;
}

interface ExamFormProps {
  initialData?: ExamRecord;
  onSubmit: (data: ExamFormData) => void;
  onCancel: () => void;
}

function ExamForm({ initialData, onSubmit, onCancel }: ExamFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [date, setDate] = useState(initialData?.date ?? "");
  const [attachment, setAttachment] = useState(initialData?.attachment ?? "");
  const [typeState, setTypeState] = useState(() =>
    splitChoice(initialData?.type, TYPE_OPTIONS),
  );
  const [durationState, setDurationState] = useState(() =>
    splitChoice(initialData?.duration, DURATION_OPTIONS),
  );

  const typeValue =
    typeState.choice === OTHER_OPTION ? typeState.custom.trim() : typeState.choice;
  const durationValue =
    durationState.choice === OTHER_OPTION
      ? durationState.custom.trim()
      : durationState.choice;

  const valid =
    title.trim() !== "" && date !== "" && typeValue !== "" && durationValue !== "";

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="exam-title">Title</Label>
        <Input
          id="exam-title"
          placeholder="e.g. Final exam — Semester 1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={typeState.choice}
          onValueChange={(value) =>
            setTypeState((prev) => ({ choice: value ?? "", custom: prev.custom }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_OPTION}>Other / Text</SelectItem>
          </SelectContent>
        </Select>
        {typeState.choice === OTHER_OPTION ? (
          <Input
            placeholder="Enter type"
            value={typeState.custom}
            onChange={(e) =>
              setTypeState((prev) => ({ choice: prev.choice, custom: e.target.value }))
            }
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="exam-date">Date</Label>
        <Input
          id="exam-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Duration</Label>
        <Select
          value={durationState.choice}
          onValueChange={(value) =>
            setDurationState((prev) => ({ choice: value ?? "", custom: prev.custom }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_OPTION}>More / Other</SelectItem>
          </SelectContent>
        </Select>
        {durationState.choice === OTHER_OPTION ? (
          <Input
            placeholder="e.g. 45 min"
            value={durationState.custom}
            onChange={(e) =>
              setDurationState((prev) => ({
                choice: prev.choice,
                custom: e.target.value,
              }))
            }
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="exam-file">Attachment</Label>
        <Input
          id="exam-file"
          type="file"
          onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? "")}
        />
        {attachment ? (
          <p className="text-xs text-muted-foreground">Selected file: {attachment}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!valid}
          onClick={() =>
            onSubmit({
              id: initialData?.id ?? crypto.randomUUID(),
              title: title.trim(),
              date,
              type: typeValue || undefined,
              duration: durationValue || undefined,
              attachment: attachment || undefined,
            })
          }
        >
          {initialData ? "Save Changes" : "Add Exam"}
        </Button>
        {initialData ? (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function ExamsPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [exams, setExams] = useState<ExamRecord[] | null>(null);
  const [editing, setEditing] = useState<ExamRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamRecord | null>(null);
  const [gradeCount, setGradeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
          const all = await listExams();
          if (cancelled) return;
          setExams(all);
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

  // The delete confirmation names the number of recorded grades.
  useEffect(() => {
    if (!deleteTarget) return;
    let cancelled = false;
    countGradesForExam(deleteTarget.id)
      .then((count) => {
        if (!cancelled) setGradeCount(count);
      })
      .catch(() => {
        if (!cancelled) setGradeCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || exams === null) {
    return <DataLoading label="Loading exams…" />;
  }

  const myExams = exams
    .filter((e) => e.teacherId === teacher.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const refreshExams = async () => {
    try {
      setError(null);
      setExams(await listExams());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSubmit = async (data: ExamFormData) => {
    try {
      setError(null);
      const existing = exams.find((e) => e.id === data.id);
      if (existing) {
        // Edits keep the exam's original scope, including its program and
        // training snapshots.
        await upsertExam({ ...existing, ...data });
      } else {
        await upsertExam({
          ...data,
          teacherId: teacher.id,
          program: "",
          training: "",
        });
      }
      setEditing(null);
      await refreshExams();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError(null);
      // Cascade: the exam's recorded grades are destroyed with it.
      await deleteExamCascade(deleteTarget.id);
      await refreshExams();
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">
        {editing ? "Edit Exam" : "Add Exam"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create exams for your classes. Choose a type, set the date and duration,
        and attach a file if needed.
      </p>

      <div className="mt-4">
        {error && (
          <div className="mb-4">
            <DataError message={error} />
          </div>
        )}
        <ExamForm
          key={editing?.id ?? "new"}
          initialData={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
      </div>

      <h3 className="mt-8 text-lg font-semibold">Saved Exams</h3>

      {myExams.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No exams yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the form above to create your first exam.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell>{exam.type || "—"}</TableCell>
                  <TableCell>{exam.duration || "—"}</TableCell>
                  <TableCell>{exam.date}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {exam.attachment || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(exam)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${exam.title}`}
                        onClick={() => setDeleteTarget(exam)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && gradeCount > 0 ? (
                <>
                  This will permanently delete “{deleteTarget.title}” and its{" "}
                  {gradeCount} recorded grade{gradeCount === 1 ? "" : "s"}.
                  Grades already entered for this exam cannot be recovered.
                </>
              ) : (
                <>
                  This will permanently delete “{deleteTarget?.title}”. No
                  grades have been recorded for it yet.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
