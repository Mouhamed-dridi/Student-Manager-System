import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuizQuestion } from "@/lib/api";
import type { TeacherCourseRecord } from "@/lib/trainings";

/** Fixed A-D slots. Keeping the count constant is what lets the correct-answer
 *  picker be a radio group with a stable value per letter. */
const OPTION_LABELS = ["A", "B", "C", "D"] as const;

function emptyQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    text: "",
    options: ["", "", "", ""],
    correctIndex: -1,
  };
}

export interface QuizDraft {
  title: string;
  description: string;
  courseId: string;
  questions: QuizQuestion[];
}

/**
 * The quiz builder. Purely presentational: it owns the question array and
 * hands a validated draft up on submit, so the page decides how to persist it.
 */
export default function QuizBuilder({
  courses,
  initial,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  courses: TeacherCourseRecord[];
  initial?: QuizDraft;
  /** `publish` is false for a draft save, true for an immediate publish. */
  onSubmit: (draft: QuizDraft, publish: boolean) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [courseId, setCourseId] = useState(initial?.courseId ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initial?.questions ?? [emptyQuestion()],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // The validation message is cleared on the next edit rather than in an
  // effect: every change already goes through one of these handlers.
  const editTitle = (value: string) => {
    setLocalError(null);
    setTitle(value);
  };
  const editDescription = (value: string) => {
    setLocalError(null);
    setDescription(value);
  };
  const editCourse = (value: string) => {
    setLocalError(null);
    setCourseId(value);
  };

  const patchQuestion = (id: string, patch: Partial<QuizQuestion>) => {
    setLocalError(null);
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const patchOption = (id: string, index: number, value: string) => {
    setLocalError(null);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const options = [...q.options];
        options[index] = value;
        return { ...q, options };
      }),
    );
  };

  const move = (index: number, delta: number) => {
    setLocalError(null);
    setQuestions((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addQuestion = () => {
    setLocalError(null);
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (id: string) => {
    setLocalError(null);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  /**
   * Returns a valid draft, or null after setting the error. Shared by both the
   * draft and the publish button so the two can't drift apart on validation.
   */
  const buildDraft = (): QuizDraft | null => {
    // Trim before validating so a title of spaces is rejected, not stored.
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setLocalError("Give the quiz a title.");
      return null;
    }
    const usable = questions.filter(
      (q) => q.text.trim() || q.options.some((o) => o.trim()),
    );
    if (usable.length === 0) {
      setLocalError("Add at least one question.");
      return null;
    }
    const incomplete = usable.some((q) => {
      const filled = q.options.filter((o) => o.trim()).length;
      return (
        !q.text.trim() ||
        filled < 2 ||
        q.correctIndex < 0 ||
        !q.options[q.correctIndex]?.trim()
      );
    });
    if (incomplete) {
      setLocalError(
        "Every question needs text, at least two options, and a correct answer that is one of its filled options.",
      );
      return null;
    }
    return {
      title: cleanTitle,
      description: description.trim(),
      courseId,
      questions: usable.map((q) => ({
        ...q,
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
      })),
    };
  };

  const handleDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = buildDraft();
    if (draft) onSubmit(draft, false);
  };

  const handlePublish = () => {
    const draft = buildDraft();
    if (draft) onSubmit(draft, true);
  };

  const courseOptions = useMemo(() => courses, [courses]);

  return (
    <form onSubmit={handleDraft} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quiz-title">Quiz title</Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(e) => editTitle(e.target.value)}
            placeholder="e.g. Week 3 network fundamentals"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Class / course</Label>
          <Select
            value={courseId}
            onValueChange={(value) => editCourse(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="No specific class" />
            </SelectTrigger>
            <SelectContent>
              {courseOptions.length === 0 ? (
                <SelectItem value="none" disabled>
                  No courses yet
                </SelectItem>
              ) : (
                courseOptions.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                    {course.training ? ` — ${course.training}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quiz-description">Description</Label>
        <Textarea
          id="quiz-description"
          value={description}
            onChange={(e) => editDescription(e.target.value)}
          placeholder="What this quiz covers (optional)"
          rows={2}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Questions ({questions.length})
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuestion}
          >
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>

        {questions.map((question, index) => (
          <Card key={question.id}>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-sm font-medium text-muted-foreground">
                  Q{index + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={question.text}
                    onChange={(e) =>
                      patchQuestion(question.id, { text: e.target.value })
                    }
                    placeholder="Question text"
                    aria-label={`Question ${index + 1} text`}
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Move down"
                    disabled={index === questions.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Delete question"
                    disabled={questions.length === 1}
                    onClick={() => removeQuestion(question.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {OPTION_LABELS.map((label, optionIndex) => {
                  const isCorrect = question.correctIndex === optionIndex;
                  const filled = Boolean(question.options[optionIndex]?.trim());
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={isCorrect ? "default" : "outline"}
                        size="icon"
                        title={
                          isCorrect
                            ? "Correct answer — click to clear"
                            : `Mark ${label} as the correct answer`
                        }
                        disabled={!filled}
                        onClick={() =>
                          patchQuestion(question.id, {
                            correctIndex: isCorrect ? -1 : optionIndex,
                          })
                        }
                      >
                        {label}
                      </Button>
                      <Input
                        value={question.options[optionIndex] ?? ""}
                        onChange={(e) =>
                          patchOption(question.id, optionIndex, e.target.value)
                        }
                        placeholder={`Option ${label}`}
                        aria-label={`Option ${label}`}
                      />
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {question.correctIndex >= 0
                  ? `Correct answer: ${OPTION_LABELS[question.correctIndex]}`
                  : "Pick the correct answer using the letter buttons."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(localError || error) && (
        <p className="text-sm text-destructive">{localError ?? error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" disabled={saving} onClick={handlePublish}>
          Publish
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
