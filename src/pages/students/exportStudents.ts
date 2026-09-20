import * as XLSX from "xlsx";
import type { Student } from "./StudentForm";

export function exportStudents(students: Student[]): void {
  if (students.length === 0) return;
  const rows = students.map((s) => [
    s.fullName,
    s.program,
    s.training,
    s.phone,
    s.email,
    s.location ?? "",
    s.education ?? "",
    s.age ?? "",
    s.engagement ?? "",
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      "Full Name",
      "Program",
      "Training",
      "Phone",
      "Email",
      "Location",
      "Education",
      "Age",
      "Engagement",
    ],
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `students-${date}.xlsx`);
}