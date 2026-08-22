import type { Student } from "@/pages/students/StudentForm";

export const DEFAULT_STUDENT_PASSWORD = "std123";

export function loadStudents(): Student[] {
  try {
    const parsed: Student[] = JSON.parse(
      localStorage.getItem("students") ?? "[]",
    );
    return parsed.map((s) => ({ ...s, training: s.training ?? "" }));
  } catch {
    return [];
  }
}

function saveStudents(students: Student[]) {
  localStorage.setItem("students", JSON.stringify(students));
}

function updateStudent(id: string, update: (s: Student) => Student) {
  const students = loadStudents().map((s) => (s.id === id ? update(s) : s));
  saveStudents(students);
}

export function hasAccount(student: Student): boolean {
  return typeof student.password === "string" && student.password.length > 0;
}

export function toggleBlocked(id: string) {
  updateStudent(id, (s) => ({ ...s, blocked: !s.blocked }));
}

export function resetPassword(id: string, password: string) {
  updateStudent(id, (s) => ({ ...s, password }));
}

export function createAccount(id: string, password: string) {
  updateStudent(id, (s) => ({ ...s, password }));
}

// Removes login access only — the rest of the student record stays intact.
export function deleteAccount(id: string) {
  updateStudent(id, (s) => {
    const next = { ...s };
    delete next.password;
    delete next.blocked;
    return next;
  });
}

// Runs on every app start: fills in any student record whose password is
// missing, undefined, or empty with the default. Never overwrites a
// password that is already set, so Reset Password results survive.
export function ensureDefaultPasswords() {
  const students = loadStudents();
  if (!students.some((s) => !s.password)) return;
  saveStudents(
    students.map((s) => ({
      ...s,
      password: s.password || DEFAULT_STUDENT_PASSWORD,
    })),
  );
}
