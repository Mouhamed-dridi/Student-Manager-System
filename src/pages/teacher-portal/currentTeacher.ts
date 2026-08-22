import type { Teacher } from "@/pages/teachers/TeacherForm";

export function loadCurrentTeacher(): Teacher | null {
  try {
    const id = localStorage.getItem("currentTeacherId");
    if (!id) return null;
    const teachers: Teacher[] = JSON.parse(
      localStorage.getItem("teachers") ?? "[]",
    );
    return teachers.find((t) => t.id === id) ?? null;
  } catch {
    return null;
  }
}
