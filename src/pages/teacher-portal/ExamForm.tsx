import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  EXAM_DURATION_OPTIONS,
  EXAM_SEMESTER_OPTIONS,
  EXAM_TYPE_OPTIONS,
  classIdForExam,
  classOptionLabel,
} from "./exams";
import type { ExamRecord } from "./exams";
import type { TeacherExamClass } from "@/lib/api";

const OTHER_OPTION = "__other";

export interface ExamFormData {
  id: string;
  title: string;
  date: string;
  type?: string;
  duration?: string;
  semester?: string;
  /** Branch the exam is scoped to (exams.branch_id). */
  classId?: string;
  /** File name shown in the table (exam.attachment). */
  attachment?: string;
  /** Newly picked file, uploaded by the page before the exam is saved. */
  attachmentFile?: File;
  /** Alias for attachmentFile */
  examFile?: File;
}

interface ExamFormProps {
  initialData?: ExamRecord;
  onSubmit: (data: ExamFormData) => Promise<void> | void;
  onCancel?: () => void;
  uploading: boolean;
  /** When true (default for new exams), an attachment file is mandatory. */
  requireAttachment?: boolean;
  /**
   * Classes the exam may be scoped to. The first one is preselected for a new
   * exam; an empty list hides the field and lets the caller keep its fallback.
   */
  classes?: TeacherExamClass[];
}

/** Keeps a stored value that is not one of the presets editable via "Other". */
function splitChoice(value: string | undefined, options: string[]) {
  if (value && !options.includes(value)) {
    return { choice: OTHER_OPTION, custom: value };
  }
  return { choice: value ?? "", custom: "" };
}

export function ExamForm({
  initialData,
  onSubmit,
  onCancel,
  uploading,
  requireAttachment,
  classes = [],
}: ExamFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [date, setDate] = useState(initialData?.date ?? "");
  const [attachment, setAttachment] = useState(initialData?.attachment ?? "");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [typeState, setTypeState] = useState(() =>
    splitChoice(initialData?.type, EXAM_TYPE_OPTIONS),
  );
  const [durationState, setDurationState] = useState(() =>
    splitChoice(initialData?.duration, EXAM_DURATION_OPTIONS),
  );
  const [semester, setSemester] = useState(initialData?.semester ?? "");
  // Empty until the teacher picks a class; the effective value below falls back
  // to the exam's own class (edit) or the first assigned class (new).
  const [classId, setClassId] = useState("");

  const isAttachmentRequired = requireAttachment ?? !initialData;

  // A new exam always starts on the first assigned class. An edited exam keeps
  // its stored class when that class is still assigned, and stays blank (=
  // "keep the current scope") when it is not, so a legacy exam is never moved
  // by editing its title.
  const preferredClassId = initialData
    ? classIdForExam(initialData, classes)
    : (classes[0]?.id ?? "");
  const selectedClassId = classes.some((entry) => entry.id === classId)
    ? classId
    : preferredClassId;

  const typeValue =
    typeState.choice === OTHER_OPTION ? typeState.custom.trim() : typeState.choice;
  const durationValue =
    durationState.choice === OTHER_OPTION
      ? durationState.custom.trim()
      : durationState.choice;

  // A new exam must be scoped to one of the assigned classes; an edited exam
  // may keep its stored scope when that class is no longer in the list.
  const classScopeValid =
    Boolean(initialData) || classes.length === 0 || selectedClassId !== "";

  const valid =
    title.trim() !== "" &&
    date !== "" &&
    typeValue !== "" &&
    durationValue !== "" &&
    semester !== "" &&
    classScopeValid;

  const handleFormSubmit = async () => {
    if (!valid || saving) return;

    if (isAttachmentRequired && !attachmentFile && !attachment) {
      setAttachmentError("Please add an exam file before submitting.");
      return;
    }

    setAttachmentError(null);
    setSaving(true);
    try {
      await onSubmit({
        id: initialData?.id ?? crypto.randomUUID(),
        title: title.trim(),
        date,
        type: typeValue || undefined,
        duration: durationValue || undefined,
        semester: semester || undefined,
        classId: selectedClassId || undefined,
        attachment: attachment || undefined,
        attachmentFile: attachmentFile ?? undefined,
        examFile: attachmentFile ?? undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleFormSubmit();
      }}
      className="max-w-xl space-y-4"
    >
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
      {classes.length > 0 ? (
        <div className="space-y-2">
          <Label>Class / Branch</Label>
          {/* Base UI prints the raw value unless the root gets `items`, so the
              UUIDs would leak into the trigger without this list. */}
          <Select
            value={selectedClassId}
            items={classes.map((entry) => ({
              value: entry.id,
              label: classOptionLabel(entry),
            }))}
            onValueChange={(value) => setClassId(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={initialData ? "Keep current class" : "Select class"}
              />
            </SelectTrigger>
            <SelectContent>
              {classes.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {classOptionLabel(entry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The exam is only visible to students of this class.
          </p>
        </div>
      ) : null}
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
            {EXAM_TYPE_OPTIONS.map((t) => (
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
        <Label>Semester</Label>
        <Select
          value={semester}
          onValueChange={(value) => setSemester(value ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select semester" />
          </SelectTrigger>
          <SelectContent>
            {EXAM_SEMESTER_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {EXAM_DURATION_OPTIONS.map((d) => (
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
        <Label htmlFor="exam-file" className="flex items-center gap-1">
          Attachment (PDF)
          {isAttachmentRequired ? (
            <span className="text-destructive font-semibold" title="Required">
              *
            </span>
          ) : null}
        </Label>
        <Input
          id="exam-file"
          type="file"
          accept=".pdf,application/pdf"
          disabled={saving}
          aria-invalid={!!attachmentError}
          className={
            attachmentError
              ? "border-destructive focus-visible:ring-destructive"
              : ""
          }
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            setAttachmentFile(picked);
            setAttachment(picked?.name ?? "");
            if (picked) {
              setAttachmentError(null);
            }
          }}
        />
        {attachmentError ? (
          <p
            id="exam-file-error"
            className="flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in duration-150"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {attachmentError}
          </p>
        ) : null}
        {attachment ? (
          <p className="text-xs text-muted-foreground">
            Selected file: {attachment}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploading ? "Uploading…" : "Saving…"}
            </span>
          ) : initialData ? (
            "Save Changes"
          ) : (
            "Add Exam"
          )}
        </Button>
        {initialData && onCancel ? (
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
