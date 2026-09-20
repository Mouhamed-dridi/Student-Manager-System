import * as XLSX from "xlsx";
import type { Teacher } from "./TeacherForm";

export function exportTeachers(teachers: Teacher[]): void {
  if (teachers.length === 0) return;
  const rows = teachers.map((t) => [
    t.fullName,
    t.specialty,
    t.jobTitle ?? "",
    t.company ?? "",
    t.location ?? "",
    t.education ?? "",
    t.phone,
    t.email,
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      "Full Name",
      "Specialty",
      "Job Title",
      "Company",
      "Location",
      "Education",
      "Phone",
      "Email",
    ],
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `teachers-${date}.xlsx`);
}