export interface ExamRecord {
  id: string;
  teacherId: string;
  program: string;
  training: string;
  title: string;
  date: string; // yyyy-mm-dd
  notes?: string;
}

export interface GradeRecord {
  id: string;
  examId: string;
  studentId: string;
  score: number;
}

const EXAMS_KEY = "exams";
const GRADES_KEY = "grades";

export function loadExams(): ExamRecord[] {
  try {
    return JSON.parse(localStorage.getItem(EXAMS_KEY) ?? "[]") as ExamRecord[];
  } catch {
    return [];
  }
}

export function saveExams(exams: ExamRecord[]): void {
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
}

export function loadGrades(): GradeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(GRADES_KEY) ?? "[]") as GradeRecord[];
  } catch {
    return [];
  }
}

export function saveGrades(grades: GradeRecord[]): void {
  localStorage.setItem(GRADES_KEY, JSON.stringify(grades));
}

export function countGradesForExam(examId: string): number {
  return loadGrades().filter((g) => g.examId === examId).length;
}
