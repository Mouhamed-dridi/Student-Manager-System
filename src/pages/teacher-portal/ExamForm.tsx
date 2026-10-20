import { useState } from "react";
import { Loader2 } from "lucide-react";
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
} from "./exams";
import type { ExamRecord } from "./exams";

const OTHER_OPTION = "__other";

export interface ExamFormData {
  id: string;
  title: string;
  date: string;
  type?: string;
  duration?: string;
  semester?: string;
  /** File name shown in the table (exam.attachment). */
  attachment?: string;
  /** Newly picked file, uploaded by the page before the exam is saved. */
  attachmentFile?: File;
}

interface ExamFormProps {
  initialData?: ExamRecord;
  onSubmit: (data: ExamFormData) => Promise<void> | void;
  onCancel?: () => void;
  uploading: boolean;
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
}: ExamFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [date, setDate] = useState(initialData?.date ?? "");
  const [attachment, setAttachment] = useState(initialData?.attachment ?? "");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [typeState, setTypeState] = useState(() =>
    splitChoice(initialData?.type, EXAM_TYPE_OPTIONS),
  );
  const [durationState, setDurationState] = useState(() =>
    splitChoice(initialData?.duration, EXAM_DURATION_OPTIONS),
  );
  const [semester, setSemester] = useState(initialData?.semester ?? "");

  const typeValue =
    typeState.choice === OTHER_OPTION ? typeState.custom.trim() : typeState.choice;
  const durationValue =
    durationState.choice === OTHER_OPTION
      ? durationState.custom.trim()
      : durationState.choice;

  const valid =
    title.trim() !== "" &&
    date !== "" &&
    typeValue !== "" &&
    durationValue !== "" &&
    semester !== "";

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
        <Label htmlFor="exam-file">Attachment (PDF)</Label>
        <Input
          id="exam-file"
          type="file"
          accept=".pdf,application/pdf"
          disabled={saving}
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            setAttachmentFile(picked);
            setAttachment(picked?.name ?? "");
          }}
        />
        {attachment ? (
          <p className="text-xs text-muted-foreground">
            Selected file: {attachment}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!valid || saving}
          onClick={async () => {
            if (!valid || saving) return;
            setSaving(true);
            try {
              await onSubmit({
                id: initialData?.id ?? crypto.randomUUID(),
                title: title.trim(),
                date,
                type: typeValue || undefined,
                duration: durationValue || undefined,
                semester: semester || undefined,
                attachment: attachment || undefined,
                attachmentFile: attachmentFile ?? undefined,
              });
            } finally {
              setSaving(false);
            }
          }}
        >
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
