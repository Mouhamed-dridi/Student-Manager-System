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

type Field = "fullname" | "subject" | "phone" | "email";

const HEADER_MAP: Record<string, Field> = {
  fullname: "fullname",
  name: "fullname",
  subject: "subject",
  specialty: "subject",
  subjectspecialty: "subject",
  phone: "phone",
  phonenumber: "phone",
  email: "email",
  emailaddress: "email",
};

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
    columns.includes("subject") &&
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
    const subject = record.get("subject");
    const phone = record.get("phone");
    const email = record.get("email");

    if (!fullName || !subject || !phone || !email) {
      result.missingData += 1;
      continue;
    }

    const key = email.toLowerCase();
    const teacher: Teacher = {
      id: crypto.randomUUID(),
      fullName,
      subject,
      phone,
      email,
    };
    result.rows.push({ teacher, duplicate: seenEmails.has(key) });
    seenEmails.add(key);
  }

  return result;
}
