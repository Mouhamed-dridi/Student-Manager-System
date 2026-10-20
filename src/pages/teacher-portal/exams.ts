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

