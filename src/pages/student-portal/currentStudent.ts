import type { Student } from "@/pages/students/StudentForm";

export function loadCurrentStudent(): Student | null {
  try {
    const id = localStorage.getItem("currentStudentId");
    if (!id) return null;
    const students: Student[] = JSON.parse(
      localStorage.getItem("students") ?? "[]",
    );
    return students.find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}
