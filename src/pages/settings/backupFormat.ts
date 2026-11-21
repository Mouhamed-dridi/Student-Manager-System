import * as XLSX from "xlsx";
import {
  countBackupRows,
  listBackupRows,
  type BackupTableName,
} from "@/lib/api";
import { t } from "@/lib/i18n";

/**
 * Shared Backup & Export formatting: SQL generation for the per-source and
 * full-backup downloads, spreadsheet row builders, plus the reverse SQL/
 * spreadsheet parsers the restore modal feeds back into `upsertBackupRows`.
 * Pure text/rows work only — every database call lives in `@/lib/api`.
 */

export interface BackupSection {
  /** Real table the rows upsert back into (INSERT targets for SQL files). */
  table: BackupTableName;
  rows: Record<string, unknown>[];
}

export interface BackupSourceDef {
  /** File stem of a per-module download, e.g. "absence" → absence-backup-….sql. */
  key: string;
  /** English display label; render it through `t()` so French gets its own. */
  label: string;
  /** Real tables written by this source, in SQL-section order. */
  tables: BackupTableName[];
  /** Table that only exists after its optional migration has been applied. */
  optional?: boolean;
}

/** Display label per backup table, shared by cards, previews and history. */
export const TABLE_LABELS: Record<BackupTableName, string> = {
  students: "Students",
  teachers: "Teachers",
  operators: "Operators",
  branches: "Branches",
  branch_materials: "Materials",
  payments: "Payments",
  payment_history: "Payments History",
  attendance: "Attendance",
  absence_billets: "Billets",
  planning: "Planning",
  exams: "Exams",
  publications: "Publications",
  events: "Events",
  center_settings: "Center Settings",
  settings: "Legacy Settings",
};

/**
 * Every table a Full System Backup contains, in restore-safe order (people
 * first, then their records and finally the center settings row). `operators`
 * and `payment_history` are part of the contract but do not exist in every
 * database: they are reported as skipped instead of failing the whole backup.
 */
export const FULL_BACKUP_TABLES: BackupTableName[] = [
  "students",
  "teachers",
  "operators",
  "branches",
  "branch_materials",
  "payments",
  "payment_history",
  "attendance",
  "absence_billets",
  "planning",
  "exams",
  "publications",
  "events",
  "center_settings",
];

/** Order defines the module card list. */
export const BACKUP_SOURCES: BackupSourceDef[] = [
  { key: "students", label: "Students", tables: ["students"] },
  { key: "teachers", label: "Teachers", tables: ["teachers"] },
  { key: "operators", label: "Operators", tables: ["operators"], optional: true },
  {
    key: "branches",
    label: "Branches",
    tables: ["branches", "branch_materials"],
    optional: true,
  },
  { key: "payments", label: "Payments", tables: ["payments"] },
  { key: "planning", label: "Planning", tables: ["planning"] },
  // Attachment URLs point at Storage files the export does not move.
  { key: "exams", label: "Exams", tables: ["exams"] },
  { key: "publications", label: "Publications", tables: ["publications"] },
  { key: "absence", label: "Absence", tables: ["attendance"] },
  { key: "events", label: "Events", tables: ["events"] },
  {
    key: "user-management",
    label: "User Management",
    tables: ["students", "teachers"],
  },
  {
    key: "settings-config",
    label: "Settings / Config",
    tables: ["center_settings"],
    optional: true,
  },
];

const backupSourceFor = (key: string): BackupSourceDef =>
  BACKUP_SOURCES.find((source) => source.key === key) ?? {
    key,
    label: key,
    tables: [],
  };

/** Real tables a restore may write to (the upsert targets). */
export const RESTORE_TABLES: { name: BackupTableName; label: string }[] = [
  ...FULL_BACKUP_TABLES,
  // Legacy dumps may still target the old key/value settings table.
  "settings" as BackupTableName,
].map((name) => ({ name, label: TABLE_LABELS[name] }));

const today = () => new Date().toISOString().slice(0, 10);

export const backupFileName = (key: string, ext: "sql" | "xlsx") =>
  `${key}-backup-${today()}.${ext}`;

/**
 * Trash filter: soft-deleted rows keep their place in a backup only while the
 * "Include deleted records" switch is on. Rows without the flag are kept.
 */
export function withoutDeletedRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.filter((row) => row.is_deleted !== true);
}

export function withoutDeletedSections(
  sections: BackupSection[],
): BackupSection[] {
  return sections.map((section) => ({
    table: section.table,
    rows: withoutDeletedRows(section.rows),
  }));
}

// ------------------------------------------------------------------- fetch

/** Fetches every section of one backup source from the database. */
export async function fetchSourceSections(
  key: string,
): Promise<BackupSection[]> {
  const { tables } = backupSourceFor(key);
  if (tables.length === 0) {
    throw new Error(`Unknown backup source: ${key}`);
  }
  return Promise.all(
    tables.map(async (table) => ({
      table,
      rows: await listBackupRows(table),
    })),
  );
}

/** Total row count shown on a card. */
export async function sourceRowCount(key: string): Promise<number> {
  const { tables } = backupSourceFor(key);
  const counts = await Promise.all(tables.map((table) => countBackupRows(table)));
  return counts.reduce((sum, count) => sum + count, 0);
}

// ------------------------------------------------------------------ SQL gen

/** Postgres string escape: standard_conforming_strings is on, so only quotes. */
const sqlEscape = (text: string) => text.replace(/'/g, "''");

/** Postgres array literal body: {"a","b"} with doubled inner quotes. */
const sqlArrayLiteral = (arr: unknown[]): string =>
  `{${arr
    .map((item) =>
      item === null || item === undefined
        ? "NULL"
        : `"${String(item).replace(/"/g, '""')}"`,
    )
    .join(",")}}`;

/** Formats one cell value as a SQL literal Postgres will accept. */
const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `'${sqlArrayLiteral(value)}'`;
  // Objects (jsonb-style columns) round-trip through their JSON text.
  if (typeof value === "object") return `'${sqlEscape(JSON.stringify(value))}'`;
  return `'${sqlEscape(String(value))}'`;
};

/** Column union across rows, so ragged rows keep every column in place. */
const columnUnion = (rows: Record<string, unknown>[]): string[] =>
  Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

const sqlStatement = (
  table: BackupTableName,
  columns: string[],
  rows: Record<string, unknown>[],
): string => {
  const columnList = columns.map((col) => `"${col}"`).join(", ");
  return rows
    .map(
      (row) =>
        `INSERT INTO public.${table} (${columnList}) VALUES (${columns
          .map((col) => sqlLiteral(row[col]))
          .join(", ")});`,
    )
    .join("\n");
};

/**
 * SQL script for one source (one or several INSERT sections), with a small
 * provenance header and a "-- No rows to export." marker when empty.
 */
export function generateSqlDocument(
  title: string,
  sections: BackupSection[],
): string {
  const parts = [
    "-- SSM Backup & Export",
    `-- Source: ${title}`,
    `-- Generated: ${new Date().toISOString()}`,
  ];
  for (const { table, rows } of sections) {
    parts.push(
      "",
      "-- ============================================================",
      `-- Table: public.${table} (${rows.length} rows)`,
      "-- ============================================================",
    );
    if (rows.length === 0) {
      parts.push("-- No rows to export.");
    } else {
      parts.push(sqlStatement(table, columnUnion(rows), rows));
    }
  }
  return `${parts.join("\n")}\n`;
}

/** One combined SQL dump, one section per table, for Full System Backup. */
export function generateFullBackupDocument(sections: BackupSection[]): string {
  return generateSqlDocument("Full system backup", sections);
}

// ------------------------------------------------------------- Excel build

/**
 * Flattens sections into spreadsheet rows. A source writing several tables
 * (User Management) gets a leading `table` column so the restore can split
 * the rows back to their target tables.
 */
export function excelRowsForSections(
  sections: BackupSection[],
): Record<string, unknown>[] {
  if (sections.length === 1) return sections[0].rows;
  return sections.flatMap((section) =>
    section.rows.map((row) => ({ table: section.table, ...row })),
  );
}

const excelValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
};

/** XLSX workbook bytes for a source — used per-card and inside the zip. */
export function workbookBytesForSections(
  sections: BackupSection[],
): ArrayBuffer {
  const columns = Array.from(
    new Set(
      sections.flatMap((section) =>
        excelRowsForSections([section]).flatMap((row) => Object.keys(row)),
      ),
    ),
  );
  const aoa = [
    columns,
    ...sections.flatMap((section) =>
      excelRowsForSections([section]).map((row) =>
        columns.map((col) => excelValue(row[col])),
      ),
    ),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(aoa),
    "backup",
  );
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return output as ArrayBuffer;
}

// ----------------------------------------------------------------- SQL parse

export interface RestoredTableGroup {
  table: BackupTableName;
  rows: Record<string, unknown>[];
}

/** Postgres array literal {"a","b"} → JS array; null when not an array. */
function postgresArrayToJs(text: string): unknown[] | null {
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  const inner = text.slice(1, -1).trim();
  if (inner === "") return [];
  const items: string[] = [];
  let item = "";
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inQuotes) {
      if (c === '"') {
        if (inner[i + 1] === '"') {
          item += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        item += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      items.push(item);
      item = "";
    } else {
      item += c;
    }
  }
  items.push(item);
  return items.map((entry) =>
    entry === "NULL" ? null : entry === "" ? "" : entry,
  );
}

/**
 * Interprets an SQL string token as a JS value: array literals become arrays
 * (text[]/uuid[] columns), JSON-shaped text becomes an object (jsonb
 * columns), everything else stays a string.
 */
function interpretSqlString(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      const array = postgresArrayToJs(trimmed);
      if (array) return array;
    }
  }
  return trimmed;
}

/** Parses the VALUES tuple of our generated INSERT format. */
function parseSqlValues(source: string): unknown[] {
  const values: unknown[] = [];
  let i = 0;
  const n = source.length;
  for (;;) {
    while (i < n && /\s/.test(source[i])) i++;
    if (i >= n) break;
    let value: unknown;
    if (source[i] === "'") {
      i++;
      let out = "";
      for (;;) {
        if (i >= n) throw new Error(t("Unterminated string in the SQL dump."));
        if (source[i] === "'") {
          if (source[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        out += source[i++];
      }
      value = interpretSqlString(out);
    } else {
      const start = i;
      while (i < n && source[i] !== ",") i++;
      const word = source.slice(start, i).trim();
      if (word === "") throw new Error(t("Malformed value in the SQL dump."));
      if (word === "NULL") value = null;
      else if (/^(TRUE|FALSE)$/i.test(word))
        value = word.toUpperCase() === "TRUE";
      else if (/^-?\d+(\.\d+)?$/.test(word)) value = Number(word);
      else value = interpretSqlString(word);
    }
    values.push(value);
    while (i < n && /\s/.test(source[i])) i++;
    if (i < n && source[i] === ",") {
      i++;
      continue;
    }
    break;
  }
  return values;
}

/** Splits on `;` at statement level; semicolons inside strings are kept. */
function splitSqlStatements(text: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      current += c;
      if (c === "'") {
        if (text[i + 1] === "'") {
          current += "'";
          i++;
        } else {
          inString = false;
        }
      }
    } else if (c === "'") {
      inString = true;
      current += c;
    } else if (c === ";") {
      statements.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim() !== "") statements.push(current);
  return statements;
}

/**
 * Parses INSERT scripts generated by this tool (per-row statements, one or
 * many tables) back into upsert-ready rows. Values are typed: NULL, TRUE/
 * FALSE, numbers, arrays and JSON objects come out as JS values.
 */
export function parseSqlDump(sqlText: string): RestoredTableGroup[] {
  const withoutComments = sqlText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  const groups = new Map<BackupTableName, Record<string, unknown>[]>();

  for (const raw of splitSqlStatements(withoutComments)) {
    const statement = raw.trim();
    if (statement === "") continue;
    const match =
      /^INSERT\s+INTO\s+(?:public\.)?"?(\w+)"?\s*\(([^)]*)\)\s*VALUES\s*([\s\S]+)$/i.exec(
        statement,
      );
    if (!match) continue;
    const table = match[1] as BackupTableName;
    if (!RESTORE_TABLES.some((entry) => entry.name === table)) {
      throw new Error(
        t("The dump targets an unsupported table: {table}.", { table }),
      );
    }
    const columns = match[2]
      .split(",")
      .map((col) => col.trim().replace(/^"(.*)"$/, "$1"));
    const tuplesSource = match[3].trim();
    // Tuple delimiters are bare parentheses; string/JSON content is quoted,
    // so a quote-aware scan can walk the tuple list directly.
    let i = 0;
    const n = tuplesSource.length;
    for (;;) {
      while (i < n && /\s/.test(tuplesSource[i])) i++;
      if (tuplesSource[i] !== "(") break;
      let depth = 0;
      let inString = false;
      const tupleStart = i;
      for (; i < n; i++) {
        const c = tuplesSource[i];
        if (inString) {
          if (c === "'") {
            if (tuplesSource[i + 1] === "'") i++;
            else inString = false;
          }
        } else if (c === "'") {
          inString = true;
        } else if (c === "(") {
          depth++;
        } else if (c === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (i >= n) throw new Error(t("Malformed SQL dump: unterminated tuple."));
      const tuple = tuplesSource.slice(tupleStart + 1, i);
      i++;
      const values = parseSqlValues(tuple);
      if (values.length !== columns.length) {
        throw new Error(
          t("Malformed SQL dump: column/value mismatch in {table}.", { table }),
        );
      }
      const row: Record<string, unknown> = {};
      columns.forEach((col, index) => {
        row[col] = values[index];
      });
      const group = groups.get(table) ?? [];
      group.push(row);
      groups.set(table, group);
    }
  }

  return Array.from(groups, ([table, rows]) => ({ table, rows }));
}

// ------------------------------------------------------------- JSON backup

export interface ParsedFullBackup {
  /** `generated_at` stamped by the export, when the file carries one. */
  generatedAt: string | null;
  /** Whether the file was written with trash rows included. */
  includeDeleted: boolean | null;
  groups: RestoredTableGroup[];
  /** Tables the exporting database did not have. */
  skipped: { table: string; message: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isKnownBackupTable = (name: string): name is BackupTableName =>
  RESTORE_TABLES.some((entry) => entry.name === name);

/**
 * Reads the JSON document written by Full System Backup:
 * `{ app, kind, tables: { students: [...], ... }, skipped: [...] }`.
 * Unknown tables are rejected (never guessed) and each value must be a list of
 * objects, so a hand-edited file cannot silently write garbage.
 */
export function parseFullBackupJson(text: string): ParsedFullBackup {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error(t("This file is not valid JSON."));
  }
  if (!isRecord(document) || !isRecord(document.tables)) {
    throw new Error(
      t("This JSON file is not a Full System Backup (no tables object)."),
    );
  }
  const tables = document.tables;
  const names = Object.keys(tables);
  if (names.length === 0) {
    throw new Error(t("The backup file lists no tables."));
  }
  const groups: RestoredTableGroup[] = [];
  for (const name of names) {
    if (!isKnownBackupTable(name)) {
      throw new Error(
        t("The backup file contains an unsupported table: {table}.", {
          table: name,
        }),
      );
    }
    const rows = tables[name];
    if (!Array.isArray(rows) || !rows.every(isRecord)) {
      throw new Error(
        t("The rows of {table} are not a list of records.", { table: name }),
      );
    }
    groups.push({
      table: name,
      rows: rows as Record<string, unknown>[],
    });
  }
  // Keep the canonical order so parent tables restore before their children.
  groups.sort(
    (a, b) =>
      RESTORE_TABLES.findIndex((entry) => entry.name === a.table) -
      RESTORE_TABLES.findIndex((entry) => entry.name === b.table),
  );
  const skippedRaw = Array.isArray(document.skipped) ? document.skipped : [];
  return {
    generatedAt:
      typeof document.generated_at === "string" ? document.generated_at : null,
    includeDeleted:
      typeof document.include_deleted === "boolean"
        ? document.include_deleted
        : null,
    groups,
    skipped: skippedRaw
      .filter(isRecord)
      .map((entry) => ({
        table: String(entry.table ?? "?"),
        message: String(entry.message ?? ""),
      })),
  };
}

// ------------------------------------------------------------ spreadsheet

export interface ParsedSpreadsheet {
  columns: string[];
  rows: Record<string, unknown>[];
}

/** Spreadsheet cells become strings (raw xlsx values keep numbers/booleans). */
function coerceCell(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const text = value.trim();
    if (/^(TRUE|FALSE)$/i.test(text)) return text.toUpperCase() === "TRUE";
    return text;
  }
  return value;
}

/**
 * Reads the first sheet of an .xlsx or .csv upload; row 1 must be the column
 * header. `raw: false` formats date cells as text so, e.g., payment dates
 * restore as their displayed value instead of an Excel serial number.
 */
export async function parseSpreadsheetFile(
  file: File,
): Promise<ParsedSpreadsheet> {
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { columns: [], rows: [] };
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (grid.length < 2) return { columns: [], rows: [] };
  const columns = (grid[0] as unknown[]).map((col) => String(col ?? "").trim());
  const rows = (grid.slice(1) as unknown[][])
    .filter((cells) => cells.some((cell) => String(cell ?? "") !== ""))
    .map((cells) => {
      const row: Record<string, unknown> = {};
      columns.forEach((col, index) => {
        row[col] = coerceCell(cells[index]);
      });
      return row;
    });
  return { columns, rows };
}
