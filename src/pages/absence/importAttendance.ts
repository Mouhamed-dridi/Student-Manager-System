import * as XLSX from "xlsx";
import type { AttendanceInput } from "@/lib/api";

export interface AttendanceImportResult {
  records: AttendanceInput[];
  skipped: number;
}

type Field =
  | "type"
  | "fullname"
  | "classname"
  | "program"
  | "training"
  | "date"
  | "time";

const HEADER_MAP: Record<string, Field> = {
  type: "type",
  kind: "type",
  fullname: "fullname",
  name: "fullname",
  classname: "classname",
  class: "classname",
  classroom: "classname",
  program: "program",
  training: "training",
  formation: "training",
  date: "date",
  day: "date",
  time: "time",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return String(value).trim();
}

function cellToTimeString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (typeof value === "number") {
    try {
      return XLSX.SSF.format("hh:mm", value);
    } catch {
      return "";
    }
  }
  return String(value).trim();
}

export async function parseAttendanceFile(
  file: File,
): Promise<AttendanceImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { records: [], skipped: 0 };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  if (rows.length < 2) return { records: [], skipped: 0 };

  const columns: (Field | null)[] = (rows[0] ?? []).map(
    (header) => HEADER_MAP[normalizeHeader(header)] ?? null,
  );
  const hasRequiredColumns =
    columns.includes("type") &&
    columns.includes("fullname") &&
    columns.includes("date");
  if (!hasRequiredColumns) return { records: [], skipped: 0 };

  const records: AttendanceInput[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const record = new Map<Field, string>();
    columns.forEach((field, index) => {
      if (!field) return;
      let value = "";
      if (field === "date") value = cellToString(row[index]);
      else if (field === "time") value = cellToTimeString(row[index]);
      else value = cellToString(row[index]);
      if (value) record.set(field, value);
    });

    const type = (record.get("type") ?? "").toLowerCase();
    const fullName = record.get("fullname");
    const date = record.get("date");
    if (
      (type !== "student" && type !== "teacher") ||
      !fullName ||
      !date
    ) {
      skipped += 1;
      continue;
    }

    records.push({
      type,
      fullName,
      className: record.get("classname"),
      program: record.get("program"),
      training: record.get("training"),
      date,
      time: record.get("time"),
    });
  }

  return { records, skipped };
}