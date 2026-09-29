import { useCallback, useEffect, useState } from "react";
import { ListChecks, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  countQuizResponses,
  deleteQuiz,
  errorMessage,
  listQuizResponses,
  listTeacherCourses,
  listTeacherQuizzes,
  saveQuiz,
  setQuizPublished,
  subscribeToTable,
  type Quiz,
  type QuizResponse,
} from "@/lib/api";
import type { TeacherCourseRecord } from "@/lib/trainings";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import QuizBuilder, { type QuizDraft } from "./qcm/QuizBuilder";
import { loadCurrentTeacher } from "./currentTeacher";

/** One response row with the student's name resolved. */
interface ResponseRow {
  response: QuizResponse;
  studentName: string;
}

/**
 * Teacher QCM: create/publish quizzes and review the answers.
 *
 * Drafts are editable, published quizzes are not (an edit to a live quiz would
 * change the answer key under students who already submitted). Re-opening a
 * published quiz is therefore read-only, and unpublishing is the way to edit it
 * again — the list makes both states explicit rather than hiding the buttons.
 */
export default function QcmPage() {
  const [teacherId, setTeacherId] = useState("");
  const [courses, setCourses] = useState<TeacherCourseRecord[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Builder state: null = browsing, otherwise the quiz being created/edited.
  const [editing, setEditing] = useState<{ id?: string; draft?: QuizDraft } | null>(
    null,
  );
  // The published quiz whose answers are open, and its loaded rows.
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async (id: string) => {
    try {
      const rows = await listTeacherQuizzes(id);
      setQuizzes(rows);
      setLoadError(null);
      setCounts(await countQuizResponses(rows.map((q) => q.id)));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  // The teacher record owns the first load: the quizzes and the course list
  // both need its id, and nothing can be queried before it resolves.
  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (teacher) => {
        if (cancelled || !teacher) return;
        setTeacherId(teacher.id);
        listTeacherCourses({ teacherId: teacher.id })
          .then((rows) => !cancelled && setCourses(rows))
          .catch(() => {});
        await refresh(teacher.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Live: the teacher publishing in another tab, or a student submitting.
  useEffect(() => {
    if (!teacherId) return;
    const offA = subscribeToTable("quizzes", () => void refresh(teacherId));
    const offB = subscribeToTable("quiz_responses", () => void refresh(teacherId));
    return () => {
      offA();
      offB();
    };
  }, [refresh, teacherId]);

  useRefetchOnFocus(() => {
    if (teacherId) void refresh(teacherId);
  });

  const openReview = useCallback(
    async (quizId: string) => {
      setReviewingId(quizId);
      setResponses(null);
      try {
        // The roster, not listStudents(): a teacher resolves names only for
        // their own class, matching the rest of the teacher portal.
        const [rows, roster] = await Promise.all([
          listQuizResponses(quizId),
          classRosterForTeacher(teacherId),
        ]);
        const names = new Map(roster.students.map((s) => [s.id, s.fullName]));
        setResponses(
          rows.map((response) => ({
            response,
            // A trashed or unlisted student still has their submission, so the
            // row is kept and named from the id rather than dropped.
            studentName: names.get(response.studentId) ?? "Removed student",
          })),
        );
      } catch (err) {
        setError(errorMessage(err));
        setResponses([]);
      }
    },
    [teacherId],
  );

  const handleSubmit = async (draft: QuizDraft, publish: boolean) => {
    if (!teacherId) return;
    setSaving(true);
    setError(null);
    try {
      await saveQuiz(
        {
          teacherId,
          title: draft.title,
          description: draft.description,
          courseId: draft.courseId,
          questions: draft.questions,
          isPublished: publish,
        },
        editing?.id,
      );
      setEditing(null);
      await refresh(teacherId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (quiz: Quiz) => {
    setError(null);
    try {
      await setQuizPublished(quiz.id, teacherId, !quiz.isPublished);
      await refresh(teacherId);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleDelete = async (quiz: Quiz) => {
    setError(null);
    try {
      await deleteQuiz(quiz.id, teacherId);
      if (reviewingId === quiz.id) setReviewingId(null);
      await refresh(teacherId);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (editing) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">
          {editing.id ? "Edit quiz" : "New quiz"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Build your questions, then save as a draft or publish straight away.
        </p>
        <div className="mt-6">
          <QuizBuilder
            courses={courses}
            initial={editing.draft}
            saving={saving}
            error={error}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
            onSubmit={(draft, publish) => void handleSubmit(draft, publish)}
          />
        </div>
      </div>
    );
  }

  // Non-null alias so the table below doesn't repeat the null check in every
  // expression; the branches below are guarded by `quizzes === null`.
  const list = quizzes ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">QCM</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create multiple-choice quizzes for your classes and review answers.
          </p>
        </div>
        <Button onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" />
          New quiz
        </Button>
      </div>

      {loadError && (
        <div className="mt-4">
          <DataError message={loadError} />
        </div>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {quizzes === null && !loadError ? (
        <div className="mt-4">
          <DataLoading label="Loading quizzes…" />
        </div>
      ) : loadError ? null : list.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No quizzes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a quiz to add questions and publish it to a class.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((quiz) => {
                const course = courses.find((c) => c.id === quiz.courseId);
                return (
                  <TableRow key={quiz.id}>
                    <TableCell className="font-medium">{quiz.title}</TableCell>
                    <TableCell>
                      <span
                        className={
                          quiz.isPublished
                            ? "rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
                            : "rounded-full border border-foreground/15 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {quiz.isPublished ? "Published" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {course ? course.name : "Unassigned"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quiz.questions.length}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {counts[quiz.id] ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Review answers"
                          onClick={() => void openReview(quiz.id)}
                        >
                          <ListChecks className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={quiz.isPublished ? "Unpublish" : "Publish"}
                          onClick={() => void togglePublish(quiz)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          disabled={quiz.isPublished}
                          onClick={() =>
                            setEditing({
                              id: quiz.id,
                              draft: {
                                title: quiz.title,
                                description: quiz.description,
                                courseId: quiz.courseId,
                                questions: quiz.questions,
                              },
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete quiz?</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{quiz.title}&quot; will be hidden from this
                                list. The row is kept in the database.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void handleDelete(quiz)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {reviewingId && (
        <ReviewPanel
          quiz={list.find((q) => q.id === reviewingId) ?? null}
          responses={responses}
          onClose={() => setReviewingId(null)}
        />
      )}
    </div>
  );
}

/** The answers for one quiz, inline rather than in a dialog: a response list is
 *  as tall as its student count. */
function ReviewPanel({
  quiz,
  responses,
  onClose,
}: {
  quiz: Quiz | null;
  responses: ResponseRow[] | null;
  onClose: () => void;
}) {
  return (
    <Card className="mt-6">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{quiz?.title ?? "Quiz"}</h3>
            <p className="text-sm text-muted-foreground">
              {quiz
                ? `${quiz.questions.length} question${quiz.questions.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {responses === null ? (
          <DataLoading label="Loading responses…" />
        ) : responses.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            No student has submitted this quiz yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map(({ response, studentName }) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium">{studentName}</TableCell>
                    <TableCell>{response.score}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {response.createdAt
                        ? new Date(response.createdAt).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
