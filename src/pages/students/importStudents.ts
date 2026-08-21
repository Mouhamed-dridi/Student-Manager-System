import * as XLSX from "xlsx";
import type { Student } from "./StudentForm";

export interface ImportResult {
  students: Student[];
  skipped: number;
}

type Field = "fullname" | "program" | "training" | "phone" | "email";

const HEADER_MAP: Record<string, Field> = {
  fullname: "fullname",
  name: "fullname",
  program: "program",
  training: "training",
  formation: "training",
  phone: "phone",
  phonenumber: "phone",
  email: "email",
  emailaddress: "email",
};

const VALID_PROGRAMS = new Set(["BTP", "BTS", "CAP"]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function cellToString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export async function parseStudentFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { students: [], skipped: 0 };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  if (rows.length < 2) return { students: [], skipped: 0 };

  const columns: (Field | null)[] = (rows[0] ?? []).map(
    (header) => HEADER_MAP[normalizeHeader(header)] ?? null,
  );
  const hasRequiredColumns =
    columns.includes("fullname") &&
    columns.includes("program") &&
    columns.includes("phone") &&
    columns.includes("email");
  if (!hasRequiredColumns) return { students: [], skipped: 0 };

  const students: Student[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const record = new Map<Field, string>();
    columns.forEach((field, index) => {
      if (!field) return;
      const value = cellToString(row[index]);
      if (value) record.set(field, value);
    });

    const fullName = record.get("fullname");
    const phone = record.get("phone");
    const email = record.get("email");
    const program = cellToString(record.get("program")).toUpperCase();
    const training = record.get("training") ?? "";

    if (!fullName || !phone || !email || !VALID_PROGRAMS.has(program)) {
      skipped += 1;
      continue;
    }

    students.push({
      id: crypto.randomUUID(),
      fullName,
      program: program as Student["program"],
      training,
      phone,
      email,
    });
  }

  return { students, skipped };
}
