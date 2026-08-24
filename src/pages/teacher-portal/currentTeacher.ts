import type { Teacher } from "@/pages/teachers/TeacherForm";
import { getTeacherById } from "@/lib/api";

// The session id stays in localStorage; the record itself lives in Supabase.
export async function loadCurrentTeacher(): Promise<Teacher | null> {
  const id = localStorage.getItem("currentTeacherId");
  if (!id) return null;
  try {
    return await getTeacherById(id);
  } catch {
    return null;
  }
}
