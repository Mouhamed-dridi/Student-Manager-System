import type { Student } from "@/pages/students/StudentForm";
import { getStudentById } from "@/lib/api";
import { getCurrentStudentId } from "@/lib/session";

export async function loadCurrentStudent(): Promise<Student | null> {
  const id = getCurrentStudentId();
  if (!id) return null;
  try {
    return await getStudentById(id);
  } catch {
    return null;
  }
}
