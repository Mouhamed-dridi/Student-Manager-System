export interface ExamRecord {
  id: string;
  teacherId: string;
  program: string;
  training: string;
  title: string;
  date: string; // yyyy-mm-dd
  type?: string;
  duration?: string;
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
