import { subjectNamesMatch } from "@/lib/courseDisplay";

export interface ExamRecord {
  id: string;
  teacherId: string;
  program: string;
  training: string;
  title: string;
  date: string; // yyyy-mm-dd
  type?: string;
  duration?: string;
  /** 'Semester 1' | 'Semester 2' (exams.semester). */
  semester?: string;
  /** Matière tag, when the row carries one (exams.subject/material/course). */
  subject?: string;
  /** Class / branch the exam was created for (exams.branch_id). */
  branchId?: string;
  /** FK snapshots of that class, on databases that ran the class migration. */
  programId?: string;
  trainingId?: string;
  /** Display name of the attached PDF (exams.file_name). */
  attachment?: string;
  /** Public URL of the attached PDF (exams.attachment_url). */
  attachmentUrl?: string;
}

export interface GradeRecord {
  id: string;
  examId: string;
  studentId: string;
  score: number;
}

/** Fixed Type choices offered by the exam form (custom values still allowed). */
export const EXAM_TYPE_OPTIONS = ["TD", "TP", "EXAM PRINCIPAL", "DS"];

/** Fixed Duration choices offered by the exam form (custom values allowed). */
export const EXAM_DURATION_OPTIONS = ["30 min", "1h", "1.5h", "2h"];

/** The only Semester values the form writes (exams.semester is plain text). */
export const EXAM_SEMESTER_OPTIONS = ["Semester 1", "Semester 2"];

/** The class fields an exam carries, plus the assigned-class list to match. */
interface ExamClassRef {
  id: string;
  name: string;
  trainingId: string;
  training: string;
}

/** "CAP · Agent d'entrepôt — ERP Consulting" (level, class, material). */
export function classOptionLabel(entry: {
  level: string;
  name: string;
  materials: string[];
  examMaterials: string[];
}): string {
  const head = [entry.level, entry.name].filter(Boolean).join(" · ");
  const material = entry.examMaterials[0] ?? entry.materials[0] ?? "";
  return material ? `${head} — ${material}` : head;
}

/**
 * The assigned class an existing exam belongs to: the stored branch id wins,
 * then the training FK, then the normalized training / class name. Returns ""
 * when the exam cannot be tied to one of the teacher's current classes, so an
 * edit never silently re-scopes a legacy exam to the first class in the list.
 */
export function classIdForExam(
  exam: Pick<ExamRecord, "branchId" | "trainingId" | "training">,
  classes: readonly ExamClassRef[],
): string {
  if (exam.branchId) {
    const byId = classes.find((entry) => entry.id === exam.branchId);
    if (byId) return byId.id;
  }
  if (exam.trainingId) {
    const byTrainingId = classes.find(
      (entry) => entry.trainingId && entry.trainingId === exam.trainingId,
    );
    if (byTrainingId) return byTrainingId.id;
  }
  const training = exam.training?.trim();
  if (!training) return "";
  const byName = classes.find(
    (entry) =>
      subjectNamesMatch(entry.training, training) ||
      subjectNamesMatch(entry.name, training),
  );
  return byName?.id ?? "";
}

