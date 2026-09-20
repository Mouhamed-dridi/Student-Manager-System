import * as XLSX from "xlsx";
import type { AttendanceRecord } from "@/lib/api";

export function exportAttendance(records: AttendanceRecord[]): void {
  if (records.length === 0) return;
  const rows = records.map((r) => [
    r.type,
    r.fullName,
    r.program ?? "",
    r.training ?? "",
    r.className ?? "",
    r.date,
    r.time ?? "",
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Type", "Full Name", "Program", "Training", "Class Name", "Date", "Time"],
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `attendance-${date}.xlsx`);
}