import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listPublishedQuizzes,
  listStudentQuizResponses,
  listTeacherCourses,
  scoreQuizAnswers,
  submitQuizResponse,
  subscribeToTable,
  type Quiz,
  type QuizResponse,
} from "@/lib/api";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type { Student } from "@/pages/students/StudentForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import { loadCurrentStudent } from "./currentStudent";

type AnswerMap = Record<string, number>;

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export default function StudentQcmPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [courses, setCourses] = useState<TeacherCourseRecord[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [responses, setResponses] = useState<Record<string, QuizResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // null = browsing the list, otherwise the quiz being taken.
  const [taking, setTaking] = useState<Quiz | null>(null);
  // The submitted (or previously submitted) quiz whose results are shown.
  const [viewing, setViewing] = useState<{
    quiz: Quiz;
    response: QuizResponse;
  } | null>(null);

  // Taking a quiz and reading its results are both sub-pages of QCM, so the
  // header arrow returns to the quiz list exactly like "Back to quizzes" does.
  useNestedView(
    taking !== null || viewing !== null,
    "quiz",
    "Quiz",
    () => {
      setTaking(null);
      setViewing(null);
    },
  );

  const refresh = useCallback(async (record: Student) => {
    try {
      setError(null);
      const [courseList, responseList] = await Promise.all([
        listTeacherCourses({
          programId: record.programId,
          trainingId: record.trainingId,
        }).catch(() => []),
        listStudentQuizResponses(record.id).catch(() => []),
      ]);
      setCourses(courseList);
      setQuizzes(
        await listPublishedQuizzes(courseList.map((course) => course.id)),
      );
      const byQuiz: Record<string, QuizResponse> = {};
      for (const response of responseList) byQuiz[response.quizId] = response;
      setResponses(byQuiz);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled) return;
        setStudent(record);
        if (record) await refresh(record);
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!student) return;
    const offA = subscribeToTable("quizzes", () => void refresh(student));
    const offB = subscribeToTable("quiz_responses", () =>
      void refresh(student),
    );
    return () => {
      offA();
      offB();
    };
  }, [student, refresh]);

  useRefetchOnFocus(() => {
    if (student) void refresh(student);
  });

  const handleSubmit = async (quiz: Quiz, answers: AnswerMap) => {
    if (!student) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const score = scoreQuizAnswers(quiz.questions, answers);
      const saved = await submitQuizResponse({
        quizId: quiz.id,
        studentId: student.id,
        answers,
        score,
      });
      setResponses((prev) => ({ ...prev, [quiz.id]: saved }));
      setTaking(null);
      setViewing({ quiz, response: saved });
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const startQuiz = (quiz: Quiz) => {
    setSubmitError(null);
    setTaking(quiz);
  };

  if (student === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your student record could not be found. It may have been removed by the
        administration.
      </p>
    );
  }

  if (student === undefined) {
    return <DataLoading label="Loading quizzes…" />;
  }

  if (taking) {
    return (
      <QuizAttempt
        quiz={taking}
        saving={saving}
        error={submitError}
        onCancel={() => {
          setTaking(null);
          setSubmitError(null);
        }}
        onSubmit={(answers) => void handleSubmit(taking, answers)}
      />
    );
  }

  if (viewing) {
    return (
      <QuizResults
        quiz={viewing.quiz}
        response={viewing.response}
        onBack={() => setViewing(null)}
      />
    );
  }

  const courseName = (courseId: string) => {
    if (!courseId) return "All classes";
    return courses.find((c) => c.id === courseId)?.name ?? "Unassigned course";
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">QCM</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Published quizzes for your class. Each quiz can be taken once.
      </p>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {quizzes === null ? (
        !error && <DataLoading label="Loading quizzes…" />
      ) : quizzes.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No quizzes available yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When your teacher publishes a quiz for your class it will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {quizzes.map((quiz) => {
            const response = responses[quiz.id];
            const total = quiz.questions.length;
            return (
              <Card key={quiz.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{quiz.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {courseName(quiz.courseId)} · {total}{" "}
                        {total === 1 ? "question" : "questions"}
                      </p>
                    </div>
                    {response && (
                      <span className="shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        {response.score}/{total}
                      </span>
                    )}
                  </div>

                  {quiz.description && (
                    <p className="text-sm text-muted-foreground">
                      {quiz.description}
                    </p>
                  )}

                  {response ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewing({ quiz, response })}
                    >
                      View results
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => startQuiz(quiz)}>
                      <ListChecks className="h-4 w-4" />
                      Start quiz
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Distraction-free quiz-taking view: one card per question, radio choices. */
function QuizAttempt({
  quiz,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  quiz: Quiz;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (answers: AnswerMap) => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const answered = Object.keys(answers).length;
  const unanswered = quiz.questions.length - answered;

  const choose = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{quiz.title}</h2>
          {quiz.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {quiz.description}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {answered} of {quiz.questions.length} answered
        {unanswered > 0
          ? ` · ${unanswered} unanswered will count as wrong`
          : ""}
      </p>

      <div className="mt-4 space-y-4">
        {quiz.questions.map((question, index) => (
          <Card key={question.id}>
            <CardContent className="space-y-3">
              <p className="font-medium">
                {index + 1}. {question.text}
              </p>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) =>
                  option.trim() ? (
                    <label
                      key={optionIndex}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                        answers[question.id] === optionIndex
                          ? "border-primary bg-primary/5"
                          : "border-foreground/15 hover:bg-accent/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={answers[question.id] === optionIndex}
                        onChange={() => choose(question.id, optionIndex)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span>
                        {OPTION_LABELS[optionIndex]}. {option}
                      </span>
                    </label>
                  ) : null,
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6">
        <Button size="lg" disabled={saving} onClick={() => onSubmit(answers)}>
          {saving ? "Submitting…" : "Submit Quiz"}
        </Button>
      </div>
    </div>
  );
}

/** Post-submission results: score fraction/percentage and per-question review. */
function QuizResults({
  quiz,
  response,
  onBack,
}: {
  quiz: Quiz;
  response: QuizResponse;
  onBack: () => void;
}) {
  const total = quiz.questions.length;
  const score = response.score;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{quiz.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Results</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to quizzes
        </Button>
      </div>

      <Card className="mt-4 max-w-xs">
        <CardContent className="py-6 text-center">
          <p className="text-3xl font-semibold">
            {score} / {total}
          </p>
          <p className="mt-1 text-lg text-muted-foreground">{percentage}%</p>
        </CardContent>
      </Card>

      <div className="mt-4 space-y-3">
        {quiz.questions.map((question, index) => {
          const selected = response.answers[question.id];
          const isCorrect = selected === question.correctIndex;
          return (
            <Card
              key={question.id}
              className={isCorrect ? "border-green-300" : "border-red-300"}
            >
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {index + 1}. {question.text}
                  </p>
                  {isCorrect ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Correct
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                      <XCircle className="h-3.5 w-3.5" />
                      Incorrect
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {question.options.map((option, optionIndex) => {
                    if (!option.trim()) return null;
                    const wasSelected = selected === optionIndex;
                    const isAnswer = question.correctIndex === optionIndex;
                    const tone = isAnswer
                      ? "border-green-300 bg-green-50 text-green-900"
                      : wasSelected
                        ? "border-red-300 bg-red-50 text-red-900"
                        : "border-foreground/10";
                    return (
                      <div
                        key={optionIndex}
                        className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${tone}`}
                      >
                        <span>
                          {OPTION_LABELS[optionIndex]}. {option}
                        </span>
                        {isAnswer && (
                          <span className="text-xs font-medium opacity-80">
                            Correct answer
                          </span>
                        )}
                        {wasSelected && !isAnswer && (
                          <span className="text-xs font-medium opacity-80">
                            Your answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isCorrect && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                    Correct answer:{" "}
                    {question.correctIndex >= 0
                      ? `${OPTION_LABELS[question.correctIndex]}. ${
                          question.options[question.correctIndex]
                        }`
                      : "—"}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <Button onClick={onBack}>Back to quizzes</Button>
      </div>
    </div>
  );
}
