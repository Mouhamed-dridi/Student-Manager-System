import type { Student } from "@/pages/students/StudentForm";
import { getStudentById } from "@/lib/api";

// The session id stays in localStorage; the record itself lives in Supabase.
export async function loadCurrentStudent(): Promise<Student | null> {
  const id = localStorage.getItem("currentStudentId");
  if (!id) return null;
  try {
    return await getStudentById(id);
  } catch {
    return null;
  }
}
