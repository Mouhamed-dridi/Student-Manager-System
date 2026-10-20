import { useState } from "react";
import { Check } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, uploadExamAttachment, upsertExam } from "@/lib/api";
import { ExamForm } from "./ExamForm";
import type { ExamFormData } from "./ExamForm";
import { useTeacherExams } from "./useTeacherExams";

/**
 * "Create Exam" section: only the Add Exam form. The saved exams live in the
 * separate Exams Table section; both read the same table through the hook.
 */
export default function CreateExamView() {
  const { teacher, exams, error, setError, refresh } = useTeacherExams();
  const [uploading, setUploading] = useState(false);
  // Bumped after a successful save so the form remounts empty instead of
  // keeping the previous title/file selection.
  const [formVersion, setFormVersion] = useState(0);
  const [created, setCreated] = useState(false);

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

  const handleSubmit = async (data: ExamFormData) => {
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
      await upsertExam({
        ...fields,
        teacherId: teacher.id,
        program: "",
        training: "",
        ...(attachmentUrl ? { attachmentUrl } : {}),
      });
      await refresh();
      setFormVersion((version) => version + 1);
      setCreated(true);
      window.setTimeout(() => setCreated(false), 2000);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">Create Exam</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create exams for your classes. Choose a type, semester, set the date and
        duration, and attach a file if needed.
      </p>

      <div className="mt-4">
        {error && (
          <div className="mb-4">
            <DataError message={error} />
          </div>
        )}
        <ExamForm
          key={`new-${formVersion}`}
          onSubmit={handleSubmit}
          uploading={uploading}
        />
        {created && (
          <p className="mt-3 flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
            <Check className="h-3.5 w-3.5" /> Exam added. Find it under Exams
            Table.
          </p>
        )}
      </div>
    </div>
  );
}
