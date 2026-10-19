export interface ExamRecord {
  id: string;
  teacherId: string;
  program: string;
  training: string;
  title: string;
  date: string; // yyyy-mm-dd
  type?: string;
  duration?: string;
  attachment?: string;
}

export interface GradeRecord {
  id: string;
  examId: string;
  studentId: string;
  score: number;
}
