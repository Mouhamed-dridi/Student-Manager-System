import { useEffect, useState } from "react";
import { Download, Eye, Search, Trash2 } from "lucide-react";
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
  uploadExamAttachment,
  upsertExam,
} from "@/lib/api";
import { EXAM_SEMESTER_OPTIONS, EXAM_TYPE_OPTIONS } from "./exams";
import type { ExamRecord } from "./exams";
import { ExamForm } from "./ExamForm";
import type { ExamFormData } from "./ExamForm";
import { useTeacherExams } from "./useTeacherExams";

const ALL = "__all";

/** Supabase serves `?download=<name>` as an attachment instead of inline. */
function attachmentDownloadUrl(url: string, name?: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("download", name?.trim() || "exam-attachment");
    return parsed.toString();
  } catch {
    return url;
  }
}

function openAttachment(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function downloadAttachment(url: string, name?: string) {
  const link = document.createElement("a");
  link.href = attachmentDownloadUrl(url, name);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * "Exams Table" section: the saved-exams list with search, filters, attachment
 * view/download, inline edit and cascade delete. Creation lives in the
 * separate Create Exam section.
 */
export default function ExamsTableView() {
  const { teacher, exams, myExams, error, setError, refresh } = useTeacherExams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [semesterFilter, setSemesterFilter] = useState(ALL);
  const [editing, setEditing] = useState<ExamRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamRecord | null>(null);
  const [gradeCount, setGradeCount] = useState(0);
  const [uploading, setUploading] = useState(false);

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

  const handleEditSubmit = async (data: ExamFormData) => {
    if (!editing) return;
    const { attachmentFile, ...fields } = data;
    try {
      setError(null);
      // Upload first: if Storage or the schema blocks it, the exam is not saved.
      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        setUploading(true);
        try {
          attachmentUrl = await uploadExamAttachment(attachmentFile, teacher.id);
        } finally {
          setUploading(false);
        }
      }
      const existing = myExams.find((e) => e.id === data.id) ?? editing;
      // Edits keep the exam's original scope, including its program and
      // training snapshots, and its previous URL when no new file was picked.
      await upsertExam({
        ...existing,
        ...fields,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      });
      setEditing(null);
      await refresh();
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
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  // Presets first, then any custom type already stored, so older free-text
  // exams stay filterable.
  const typeOptions = Array.from(
    new Set([
      ...EXAM_TYPE_OPTIONS,
      ...myExams
        .map((e) => e.type)
        .filter((t): t is string => Boolean(t)),
    ]),
  ).sort();

  const query = search.trim().toLowerCase();
  const hasFilters = query !== "" || typeFilter !== ALL || semesterFilter !== ALL;
  const filtered = myExams.filter((exam) => {
    if (typeFilter !== ALL && (exam.type ?? "") !== typeFilter) return false;
    if (semesterFilter !== ALL && (exam.semester ?? "") !== semesterFilter) {
      return false;
    }
    if (!query) return true;
    return [exam.title, exam.type, exam.semester, exam.duration, exam.date].some(
      (value) => (value ?? "").toLowerCase().includes(query),
    );
  });

  const clearFilters = () => {
    setSearch("");
    setTypeFilter(ALL);
    setSemesterFilter(ALL);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">Exams Table</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Every exam you created. Open or download the attached PDF, edit an exam,
        or delete it with its recorded grades.
      </p>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {editing && (
        <Card className="mt-4 max-w-xl">
          <CardContent className="pt-6">
            <h4 className="text-base font-semibold">Edit Exam</h4>
            <div className="mt-3">
              <ExamForm
                key={editing.id}
                initialData={editing}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditing(null)}
                uploading={uploading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Search title, type, semester…"
            aria-label="Search exams"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value ?? ALL)}
        >
          <SelectTrigger className="w-44" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={semesterFilter}
          onValueChange={(value) => setSemesterFilter(value ?? ALL)}
        >
          <SelectTrigger className="w-44" aria-label="Filter by semester">
            <SelectValue placeholder="All semesters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All semesters</SelectItem>
            {EXAM_SEMESTER_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {myExams.length}
        </span>
      </div>

      <div className="mt-3">
        {myExams.length === 0 ? (
          <Card className="max-w-xl">
            <CardContent className="py-8 text-center">
              <p className="text-sm font-medium">No exams yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use Create Exam in the sidebar to add your first exam.
              </p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="max-w-xl">
            <CardContent className="py-8 text-center">
              <p className="text-sm font-medium">No matching exams</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or filter.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{exam.type || "—"}</TableCell>
                    <TableCell>{exam.semester || "—"}</TableCell>
                    <TableCell>{exam.duration || "—"}</TableCell>
                    <TableCell>{exam.date}</TableCell>
                    <TableCell className="max-w-xs">
                      {exam.attachment ? (
                        <span
                          className="block truncate text-muted-foreground"
                          title={exam.attachment}
                        >
                          {exam.attachment}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-2">
                        {exam.attachmentUrl ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Preview ${exam.attachment ?? "attachment"}`}
                              title="Preview"
                              onClick={() =>
                                openAttachment(exam.attachmentUrl!)
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Download ${exam.attachment ?? "attachment"}`}
                              title="Download"
                              onClick={() =>
                                downloadAttachment(
                                  exam.attachmentUrl!,
                                  exam.attachment,
                                )
                              }
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
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
                          title="Delete"
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
      </div>

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
