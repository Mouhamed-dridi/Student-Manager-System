import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  teacherCourseAssignment,
  teacherExamClasses,
  uploadExamAttachment,
  upsertExam,
  type TeacherExamClass,
} from "@/lib/api";
import { ExamForm } from "./ExamForm";
import type { ExamFormData } from "./ExamForm";
import { useTeacherExams } from "./useTeacherExams";

/**
 * "Create Exam" section: only the Add Exam form. The saved exams live in the
 * separate Exams Table section; both read the same table through the hook.
 *
 * The form also gets the classes this teacher is staffed in, so a multi-class
 * ERP/SAP teacher can choose the CAP/BTP/BTS class the exam belongs to instead
 * of inheriting one profile-level class for every exam.
 */
export default function CreateExamView() {
  const { teacher, exams, error, setError, refresh } = useTeacherExams();
  const [uploading, setUploading] = useState(false);
  // Bumped after a successful save so the form remounts empty instead of
  // keeping the previous title/file selection.
  const [formVersion, setFormVersion] = useState(0);
  const [created, setCreated] = useState(false);
  // null = still resolving; [] = the teacher has no staffed class.
  const [classes, setClasses] = useState<TeacherExamClass[] | null>(null);

  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    teacherExamClasses(teacher.id, teacher.fullName)
      .then((list) => {
        if (!cancelled) setClasses(list);
      })
      .catch((err) => {
        if (cancelled) return;
        // A failed lookup must not block exam creation: the form simply falls
        // back to the teacher's resolved class.
        setError(errorMessage(err));
        setClasses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teacher, setError]);

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || exams === null || classes === null) {
    return <DataLoading label="Loading exams…" />;
  }

  const handleSubmit = async (data: ExamFormData) => {
    const examFile = data.attachmentFile ?? data.examFile;

    // Validation Check on Submit:
    // Verify that an exam file/attachment has been selected.
    if (!examFile) {
      setError("Please add an exam file before submitting.");
      return;
    }

    const {
      attachmentFile: _unused,
      examFile: _alsoUnused,
      classId,
      ...fields
    } = data;
    try {
      setError(null);
      // Supabase Storage Upload:
      // Ensure the selected exam file is successfully uploaded to the storage bucket
      // before completing the exam record creation.
      setUploading(true);
      let attachmentUrl: string;
      try {
        attachmentUrl = await uploadExamAttachment(examFile, teacher.id);
      } finally {
        setUploading(false);
      }

      // Stamp the exam with the class the teacher picked so the student portal
      // shows it only to that branch. Without a staffed class the old
      // profile-level fallback is kept.
      const selected = classes.find((entry) => entry.id === classId) ?? null;
      const scope = selected
        ? {
            program: selected.program,
            training: selected.training,
            programId: selected.programId || undefined,
            trainingId: selected.trainingId || undefined,
            branchId: selected.id,
            subject:
              selected.examMaterials[0] ?? selected.materials[0] ?? undefined,
          }
        : await teacherCourseAssignment(teacher.id);

      await upsertExam({
        ...fields,
        teacherId: teacher.id,
        ...scope,
        attachment: examFile.name,
        attachmentUrl,
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
        Create exams for your classes. Choose the class the exam belongs to, a
        type, semester, the date and duration, then attach the exam PDF
        (required).
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
          requireAttachment
          classes={classes}
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
