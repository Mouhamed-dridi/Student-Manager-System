import type { Teacher } from "@/pages/teachers/TeacherForm";
import { getTeacherById } from "@/lib/api";
import { getCurrentTeacherId } from "@/lib/session";

export async function loadCurrentTeacher(): Promise<Teacher | null> {
  const id = getCurrentTeacherId();
  if (!id) return null;
  try {
    return await getTeacherById(id);
  } catch {
    return null;
  }
}
