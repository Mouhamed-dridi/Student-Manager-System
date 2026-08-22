import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadCurrentTeacher } from "./currentTeacher";
import {
  countGradesForExam,
  loadExams,
  loadGrades,
  saveExams,
  saveGrades,
  type ExamRecord,
} from "./exams";

interface ExamFormData {
  id: string;
  title: string;
  date: string;
  notes?: string;
}

interface ExamFormDialogProps {
  initialData?: ExamRecord;
  onSubmit: (data: ExamFormData) => void;
  onClose: () => void;
}

function ExamFormDialog({ initialData, onSubmit, onClose }: ExamFormDialogProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [date, setDate] = useState(initialData?.date ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const handleSave = () => {
    if (!title.trim() || !date) return;
    onSubmit({
      id: initialData?.id ?? crypto.randomUUID(),
      title: title.trim(),
      date,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Exam" : "Add Exam"}</DialogTitle>
          <DialogDescription>
            Exams are visible only to your class.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label htmlFor="exam-notes">Notes (optional)</Label>
            <Textarea
              id="exam-notes"
              placeholder="Room, duration, materials…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || !date}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExamsPage() {
  const [teacher] = useState(loadCurrentTeacher);
  const [exams, setExams] = useState(loadExams);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExamRecord | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ExamRecord | null>(null);

  if (!teacher) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  const myExams = exams
    .filter((e) => e.program === teacher.program && e.training === teacher.training)
    .sort((a, b) => b.date.localeCompare(a.date));

  const refreshExams = () => setExams(loadExams());

  const handleSave = (data: ExamFormData) => {
    const all = loadExams();
    const idx = all.findIndex((e) => e.id === data.id);
    if (idx >= 0) {
      // Edits keep the exam scoped to its original class, even if the
      // teacher's assignment has since changed.
      all[idx] = { ...all[idx], ...data };
    } else {
      all.push({
        ...data,
        teacherId: teacher.id,
        program: teacher.program,
        training: teacher.training,
      });
    }
    saveExams(all);
    refreshExams();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    // Cascade: the exam's recorded grades are destroyed with it.
    saveGrades(loadGrades().filter((g) => g.examId !== deleteTarget.id));
    saveExams(loadExams().filter((e) => e.id !== deleteTarget.id));
    refreshExams();
    setDeleteTarget(null);
  };

  const gradeCount = deleteTarget ? countGradesForExam(deleteTarget.id) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Exams</h2>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Exam
        </Button>
      </div>

      {myExams.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No exams yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first exam to start recording grades.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell>{exam.date}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {exam.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(exam);
                          setFormOpen(true);
                        }}
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

      {formOpen && (
        <ExamFormDialog
          initialData={editing}
          onSubmit={handleSave}
          onClose={() => setFormOpen(false)}
        />
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
