import * as XLSX from "xlsx";
import type { Teacher } from "./TeacherForm";

export interface TeacherImportRow {
  teacher: Teacher;
  duplicate: boolean;
}

export interface ImportResult {
  rows: TeacherImportRow[];
  missingData: number;
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

export async function parseTeacherFile(
  file: File,
  existingEmails: string[],
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { rows: [], missingData: 0 };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  if (rows.length < 2) return { rows: [], missingData: 0 };

  const columns: (Field | null)[] = (rows[0] ?? []).map(
    (header) => HEADER_MAP[normalizeHeader(header)] ?? null,
  );
  const hasRequiredColumns =
    columns.includes("fullname") &&
    columns.includes("program") &&
    columns.includes("phone") &&
    columns.includes("email");
  if (!hasRequiredColumns) return { rows: [], missingData: 0 };

  const seenEmails = new Set(
    existingEmails.map((email) => email.trim().toLowerCase()),
  );
  const result: ImportResult = { rows: [], missingData: 0 };

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
      result.missingData += 1;
      continue;
    }

    const key = email.toLowerCase();
    const teacher: Teacher = {
      id: crypto.randomUUID(),
      fullName,
      program: program as Teacher["program"],
      training,
      phone,
      email,
    };
    result.rows.push({ teacher, duplicate: seenEmails.has(key) });
    seenEmails.add(key);
  }

  return result;
}
