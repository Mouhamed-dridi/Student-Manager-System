import { supabase } from "@/lib/supabase";
import { getRole } from "@/lib/session";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { Payment } from "@/pages/pay/PaymentForm";
import type { Publication } from "@/pages/publications/PublicationsPage";
import type { CourseMaterial, TeacherCourseRecord } from "@/lib/trainings";
import type { ExamRecord, GradeRecord } from "@/pages/teacher-portal/exams";
import type { PlanningRecord } from "@/pages/teacher-portal/planning";

// Every Supabase call in the app goes through this module. Rows use
// snake_case column names; mappers convert to/from the camelCase shapes
// the UI already uses, so components keep working unchanged.

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not reach the database. Check your connection and try again.";
}

const DEFAULT_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 8000;

/**
 * Guarantees a query settles even when the underlying Supabase fetch stalls
 * (a request can hang indefinitely if the network silently drops). On
 * timeout the promise rejects instead of freezing a page on Loading.
 */
function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The request timed out. Please try again.")),
      ms,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function rows<T>(
  table: string,
  query?: {
    eq?: Record<string, string>;
    order?: { column: string; ascending?: boolean };
  },
  select = "*",
): Promise<T[]> {
  let builder = supabase.from(table).select(select);
  for (const [column, value] of Object.entries(query?.eq ?? {})) {
    builder = builder.eq(column, value);
  }
  if (query?.order) {
    builder = builder.order(query.order.column, {
      ascending: query.order.ascending ?? true,
    });
  }
  const { data, error } = await withTimeout(builder);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

// ---------------------------------------------------------------- programs

interface ProgramRow {
  id: string;
  code: string;
  name: string;
}

interface TrainingRow {
  id: string;
  name: string;
  program_id: string;
}

export async function listPrograms(): Promise<ProgramRow[]> {
  return rows<ProgramRow>("programs", { order: { column: "code" } });
}

export async function listTrainings(
  programId?: string,
): Promise<TrainingRow[]> {
  return rows<TrainingRow>(
    "trainings",
    programId ? { eq: { program_id: programId } } : undefined,
  );
}

async function resolveProgramTrainingIds(
  programCode: string,
  trainingName: string,
): Promise<{ programId: string; trainingId: string }> {
  const program = (
    await withTimeout(
      supabase.from("programs").select("id").eq("code", programCode).maybeSingle(),
    )
  ).data;
  const training = (
    await withTimeout(
      supabase.from("trainings").select("id").eq("name", trainingName).maybeSingle(),
    )
  ).data;
  return {
    programId: program?.id ?? "",
    trainingId: training?.id ?? "",
  };
}

// ---------------------------------------------------------------- students

interface StudentRow {
  id: string;
  full_name: string;
  program_id: string | null;
  training_id: string | null;
  programs: { code: string } | null;
  trainings: { name: string } | null;
  phone: string;
  email: string;
  location: string | null;
  education: string | null;
  age: number | null;
  engagement: string | null;
  password: string | null;
  blocked: boolean | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    fullName: row.full_name,
    program: (row.programs?.code ?? "") as Student["program"],
    training: row.trainings?.name ?? "",
    programId: row.program_id ?? undefined,
    trainingId: row.training_id ?? undefined,
    phone: row.phone ?? "",
    email: row.email ?? "",
    location: row.location ?? undefined,
    education: row.education ?? undefined,
    age: row.age ?? undefined,
    engagement: row.engagement ?? undefined,
    password: row.password ?? undefined,
    blocked: row.blocked === true ? true : undefined,
  };
}

async function studentToRow(student: Student) {
  const { programId, trainingId } = await resolveProgramTrainingIds(
    student.program,
    student.training,
  );
  return {
    id: student.id,
    full_name: student.fullName,
    program_id: programId || null,
    training_id: trainingId || null,
    phone: student.phone,
    email: student.email,
    location: student.location ?? null,
    education: student.education ?? null,
    age: student.age ?? null,
    engagement: student.engagement ?? null,
    password: student.password ?? null,
    blocked: student.blocked === true,
  };
}

const STUDENT_SELECT = "*, programs(code), trainings(name)";

export async function listStudents(): Promise<Student[]> {
  const capabilities = await generalTrashCapabilities();
  const { data, error } = capabilities.students
    ? await withTimeout(
        supabase
          .from("students")
          .select(STUDENT_SELECT)
          .or("is_deleted.is.false,is_deleted.is.null"),
      )
    : await withTimeout(supabase.from("students").select(STUDENT_SELECT));
  if (error) throw new Error(error.message);
  let students = (data ?? []).map((row) => studentFromRow(row as StudentRow));
  if (!capabilities.students) {
    students = students.filter(
      (s) => !localGeneralTrashDeletedAt.has(generalTrashKey("students", s.id)),
    );
  }
  return students;
}

export async function getStudentById(id: string): Promise<Student | null> {
  const { data, error } = await withTimeout(
    supabase.from("students").select(STUDENT_SELECT).eq("id", id).maybeSingle(),
  );
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as StudentRow;
  if (row.is_deleted === true) return null;
  return studentFromRow(row);
}

/** Inserts a student; login fields are included when present. */
export async function insertStudent(student: Student): Promise<Student> {
  const row = await studentToRow(student);
  const { data, error } = await withTimeout(
    supabase.from("students").insert(row).select(STUDENT_SELECT).single(),
  );
  if (error) throw new Error(error.message);
  return studentFromRow(data as StudentRow);
}

/** Bulk insert used by the Excel import flow. */
export async function insertStudents(students: Student[]): Promise<void> {
  if (students.length === 0) return;
  const mapped = await Promise.all(students.map(studentToRow));
  const { error } = await withTimeout(supabase.from("students").insert(mapped));
  if (error) throw new Error(error.message);
}

export interface StudentsImportSummary {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Excel-import writer with duplicate-email handling. Emails already present
 * in `existing` are UPDATEd in place (profile fields only — login data is
 * preserved); brand-new emails are INSERTed. Within-file duplicate rows are
 * collapsed (last row wins) and counted as skipped. As a safety net against
 * two operators importing the same email at the same time, the insert batch
 * retries row-by-row and counts late unique collisions as skipped instead of
 * throwing an unhandled constraint error.
 */
export async function importStudentRecords(
  students: Student[],
  existing: Student[],
): Promise<StudentsImportSummary> {
  if (students.length === 0) return { added: 0, updated: 0, skipped: 0 };

  const existingByEmail = new Map<string, Student>();
  for (const s of existing) {
    const key = s.email.trim().toLowerCase();
    if (key && !existingByEmail.has(key)) existingByEmail.set(key, s);
  }

  const byEmail = new Map<string, Student>();
  let skipped = 0;
  for (const s of students) {
    const key = s.email.trim().toLowerCase();
    if (!key) {
      skipped += 1;
      continue;
    }
    if (byEmail.has(key)) skipped += 1;
    byEmail.set(key, s);
  }

  let updated = 0;
  const fresh: Student[] = [];
  for (const [key, s] of byEmail) {
    const current = existingByEmail.get(key);
    if (current) {
      await updateStudentProfile(current.id, s);
      updated += 1;
    } else {
      fresh.push(s);
    }
  }

  let added = fresh.length;
  if (fresh.length > 0) {
    try {
      await insertStudents(fresh);
    } catch {
      // Uniqueness race — a matching record appeared between the page load
      // and this import. Try each row alone and skip genuine duplicate-key
      // collisions so the import never crashes.
      added = 0;
      for (const s of fresh) {
        try {
          await insertStudent(s);
          added += 1;
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes("duplicate key value")
          ) {
            skipped += 1;
          } else {
            throw err;
          }
        }
      }
    }
  }

  return { added, updated, skipped };
}

/**
 * Updates only the profile fields the Add/Edit form owns. Login data
 * (password/blocked) is intentionally left untouched on edits.
 */
export async function updateStudentProfile(
  id: string,
  profile: Pick<
    Student,
    | "fullName"
    | "program"
    | "training"
    | "phone"
    | "email"
    | "location"
    | "education"
    | "age"
    | "engagement"
  >,
): Promise<void> {
  const { programId, trainingId } = await resolveProgramTrainingIds(
    profile.program,
    profile.training,
  );
  const { error } = await withTimeout(
    supabase
      .from("students")
      .update({
        full_name: profile.fullName,
        program_id: programId || null,
        training_id: trainingId || null,
        phone: profile.phone,
        email: profile.email,
        location: profile.location ?? null,
        education: profile.education ?? null,
        age: profile.age ?? null,
        engagement: profile.engagement ?? null,
      })
      .eq("id", id),
  );
  if (error) throw new Error(error.message);
}

/** Permanent delete: destroys rows immediately (used by the Trash page). */
export async function hardDeleteStudents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await withTimeout(
    supabase.from("students").delete().in("id", ids),
  );
  if (error) throw new Error(error.message);
}

/** Soft-deletes: moves rows to the general Trash when the columns exist. */
export async function softDeleteStudents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.students) {
    const now = new Date().toISOString();
    for (const id of ids)
      localGeneralTrashDeletedAt.set(generalTrashKey("students", id), now);
    return;
  }
  const now = new Date().toISOString();
  const { error } = await withTimeout(
    supabase
      .from("students")
      .update({ is_deleted: true, deleted_at: now })
      .in("id", ids),
  );
  if (error) throw new Error(error.message);
}

/** Restores soft-deleted students back to the active list. */
export async function restoreStudents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.students) {
    for (const id of ids)
      localGeneralTrashDeletedAt.delete(generalTrashKey("students", id));
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("students")
      .update({ is_deleted: false, deleted_at: null })
      .in("id", ids),
  );
  if (error) throw new Error(error.message);
}

// Lightweight shape used by User Management: only the columns it needs,
// selected explicitly so the password column is never lost to join syntax.
export interface AccountInfo {
  id: string;
  fullName: string;
  password?: string;
  blocked?: boolean;
  program: string;
  training: string;
  specialty?: string;
}

export async function listStudentAccounts(): Promise<AccountInfo[]> {
  const capabilities = await generalTrashCapabilities();
  const builder = capabilities.students
    ? supabase
        .from("students")
        .select("id, full_name, password, blocked, programs(code), trainings(name)")
        .or("is_deleted.is.false,is_deleted.is.null")
    : supabase
        .from("students")
        .select("id, full_name, password, blocked, programs(code), trainings(name)");
  const { data, error } = await withTimeout(builder);
  if (error) throw new Error(error.message);
  let accounts = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? "",
    password: (r.password as string) ?? undefined,
    blocked: r.blocked === true,
    program: ((r.programs as { code: string } | null)?.code ?? "") as Student["program"],
    training: (r.trainings as { name: string } | null)?.name ?? "",
  }));
  if (!capabilities.students) {
    accounts = accounts.filter(
      (a) => !localGeneralTrashDeletedAt.has(generalTrashKey("students", a.id)),
    );
  }
  return accounts;
}

// ---------------------------------------------------------------- teachers

interface TeacherRow {
  id: string;
  full_name: string;
  specialty: string | null;
  phone: string;
  email: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  education: string | null;
  program: string | null;
  training: string | null;
  password: string | null;
  blocked: boolean | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

function teacherFromRow(row: TeacherRow): Teacher {
  return {
    id: row.id,
    fullName: row.full_name,
    specialty: row.specialty ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    program: (row.program ?? undefined) as Teacher["program"],
    training: row.training ?? undefined,
    jobTitle: row.job_title ?? undefined,
    company: row.company ?? undefined,
    location: row.location ?? undefined,
    education: row.education ?? undefined,
    password: row.password ?? undefined,
    blocked: row.blocked === true ? true : undefined,
  };
}

async function teacherToRow(teacher: Teacher) {
  return {
    id: teacher.id,
    full_name: teacher.fullName,
    specialty: teacher.specialty ?? "",
    phone: teacher.phone,
    email: teacher.email,
    program: teacher.program ?? null,
    training: teacher.training ?? null,
    job_title: teacher.jobTitle ?? null,
    company: teacher.company ?? null,
    location: teacher.location ?? null,
    education: teacher.education ?? null,
    password: teacher.password ?? null,
    blocked: teacher.blocked === true,
  };
}

const TEACHER_SELECT = "*";

export async function listTeachers(): Promise<Teacher[]> {
  const capabilities = await generalTrashCapabilities();
  const { data, error } = capabilities.teachers
    ? await withTimeout(
        supabase
          .from("teachers")
          .select(TEACHER_SELECT)
          .or("is_deleted.is.false,is_deleted.is.null"),
      )
    : await withTimeout(supabase.from("teachers").select(TEACHER_SELECT));
  if (error) throw new Error(error.message);
  let teachers = (data ?? []).map((row) => teacherFromRow(row as TeacherRow));
  if (!capabilities.teachers) {
    teachers = teachers.filter(
      (t) => !localGeneralTrashDeletedAt.has(generalTrashKey("teachers", t.id)),
    );
  }
  return teachers;
}

export async function getTeacherById(id: string): Promise<Teacher | null> {
  const { data, error } = await withTimeout(
    supabase.from("teachers").select(TEACHER_SELECT).eq("id", id).maybeSingle(),
  );
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as TeacherRow;
  if (row.is_deleted === true) return null;
  return teacherFromRow(row);
}

export async function insertTeacher(teacher: Teacher): Promise<Teacher> {
  const row = await teacherToRow(teacher);
  const { data, error } = await withTimeout(
    supabase.from("teachers").insert(row).select(TEACHER_SELECT).single(),
  );
  if (error) throw new Error(error.message);
  return teacherFromRow(data as TeacherRow);
}

/** Bulk insert used by the Excel import flow. */
export async function insertTeachers(teachers: Teacher[]): Promise<void> {
  if (teachers.length === 0) return;
  const mapped = await Promise.all(teachers.map(teacherToRow));
  const { error } = await withTimeout(supabase.from("teachers").insert(mapped));
  if (error) throw new Error(error.message);
}

export async function updateTeacherProfile(
  id: string,
  profile: Pick<
    Teacher,
    | "fullName"
    | "specialty"
    | "phone"
    | "email"
    | "jobTitle"
    | "company"
    | "location"
    | "education"
    | "program"
    | "training"
  >,
): Promise<void> {
  const { error } = await withTimeout(
    supabase
      .from("teachers")
      .update({
        full_name: profile.fullName,
        specialty: profile.specialty ?? "",
        phone: profile.phone,
        email: profile.email,
        job_title: profile.jobTitle ?? null,
        company: profile.company ?? null,
        location: profile.location ?? null,
        education: profile.education ?? null,
        program: profile.program ?? null,
        training: profile.training ?? null,
      })
      .eq("id", id),
  );
  if (error) throw new Error(error.message);
}

/** Permanent delete: destroys rows immediately (used by the Trash page). */
export async function hardDeleteTeachers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await withTimeout(
    supabase.from("teachers").delete().in("id", ids),
  );
  if (error) throw new Error(error.message);
}

/** Soft-deletes: moves rows to the general Trash when the columns exist. */
export async function softDeleteTeachers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.teachers) {
    const now = new Date().toISOString();
    for (const id of ids)
      localGeneralTrashDeletedAt.set(generalTrashKey("teachers", id), now);
    return;
  }
  const now = new Date().toISOString();
  const { error } = await withTimeout(
    supabase
      .from("teachers")
      .update({ is_deleted: true, deleted_at: now })
      .in("id", ids),
  );
  if (error) throw new Error(error.message);
}

/** Restores soft-deleted teachers back to the active list. */
export async function restoreTeachers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.teachers) {
    for (const id of ids)
      localGeneralTrashDeletedAt.delete(generalTrashKey("teachers", id));
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("teachers")
      .update({ is_deleted: false, deleted_at: null })
      .in("id", ids),
  );
  if (error) throw new Error(error.message);
}

export async function listTeacherAccounts(): Promise<AccountInfo[]> {
  const capabilities = await generalTrashCapabilities();
  const builder = capabilities.teachers
    ? supabase
        .from("teachers")
        .select("id, full_name, password, blocked, specialty")
        .or("is_deleted.is.false,is_deleted.is.null")
    : supabase
        .from("teachers")
        .select("id, full_name, password, blocked, specialty");
  const { data, error } = await withTimeout(builder);
  if (error) throw new Error(error.message);
  let accounts = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? "",
    password: (r.password as string) ?? undefined,
    blocked: r.blocked === true,
    program: "",
    training: "",
    specialty: (r.specialty as string | null) ?? "",
  }));
  if (!capabilities.teachers) {
    accounts = accounts.filter(
      (a) => !localGeneralTrashDeletedAt.has(generalTrashKey("teachers", a.id)),
    );
  }
  return accounts;
}

// -------------------------------------------------------- login accounts

export type AccountKind = "students" | "teachers";

/**
 * Patches only the login columns of a student/teacher record. Passing
 * `null` clears a field (used when an account is deleted).
 */
export async function updateAccount(
  kind: AccountKind,
  id: string,
  patch: { password?: string | null; blocked?: boolean | null },
): Promise<void> {
  const payload: Record<string, string | boolean | null> = {};
  if (patch.password !== undefined) payload.password = patch.password;
  if (patch.blocked !== undefined) payload.blocked = patch.blocked;
  const { error } = await withTimeout(
    supabase.from(kind).update(payload).eq("id", id),
  );
  if (error) throw new Error(error.message);
}

export async function getBlocked(kind: AccountKind, id: string): Promise<boolean> {
  const { data, error } = await withTimeout(
    supabase.from(kind).select("blocked").eq("id", id).single(),
  );
  if (error) throw new Error(error.message);
  return (data as { blocked: boolean | null }).blocked === true;
}

// ---------------------------------------------------------------- payments

interface PaymentRow {
  id: string;
  student_id: string;
  amount: number;
  plan_type: string;
  payment_date: string;
  status: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  edit_history: unknown;
  created_at: string | null;
}

function paymentFromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    studentId: row.student_id,
    amount: Number(row.amount),
    planType: row.plan_type as Payment["planType"],
    paymentDate: row.payment_date,
    status: row.status ?? undefined,
    isDeleted: row.is_deleted === true,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at ?? undefined,
    studentName: "",
  };
}

/**
 * Payment column support is detected at runtime: some deployments of the
 * payments table omit the trash (is_deleted / deleted_at) and history
 * (edit_history) columns. When a column is missing the app degrades instead
 * of querying it (which PostgREST rejects with "column does not exist"):
 *  - active filtering falls back to "every row is active"
 *  - trash is tracked in memory for the current session only
 *  - edits are appended to an in-memory history log instead of the DB column
 */
interface PaymentsCapabilities {
  supportsTrash: boolean;
  supportsHistory: boolean;
}

let paymentsCapabilitiesPromise: Promise<PaymentsCapabilities> | null = null;

function detectPaymentsCapabilities(): Promise<PaymentsCapabilities> {
  if (!paymentsCapabilitiesPromise) {
    paymentsCapabilitiesPromise = (async () => {
      const [hasIsDeleted, hasDeletedAt, hasEditHistory] = await Promise.all([
        hasColumn("payments", "is_deleted"),
        hasColumn("payments", "deleted_at"),
        hasColumn("payments", "edit_history"),
      ]);
      return {
        supportsTrash: hasIsDeleted && hasDeletedAt,
        supportsHistory: hasEditHistory,
      };
    })().catch(() => ({ supportsTrash: false, supportsHistory: false }));
  }
  return paymentsCapabilitiesPromise;
}

/** True when the payments table actually has is_deleted/deleted_at columns. */
export async function paymentsSupportsTrash(): Promise<boolean> {
  return (await detectPaymentsCapabilities()).supportsTrash;
}

/** True when the payments table actually has the edit_history jsonb column. */
export async function paymentsSupportsHistory(): Promise<boolean> {
  return (await detectPaymentsCapabilities()).supportsHistory;
}

/** In-memory fallbacks used ONLY when the matching DB columns are absent. */
const localTrashDeletedAt = new Map<string, string>();
const localEditHistory: PaymentHistoryItem[] = [];

/** Active payments only, newest first. */
export async function listPayments(): Promise<Payment[]> {
  const caps = await detectPaymentsCapabilities();
  const { data, error } = caps.supportsTrash
    ? await withTimeout(
        supabase
          .from("payments")
          .select("*")
          .or("is_deleted.is.false,is_deleted.is.null")
          .order("created_at", { ascending: false }),
      )
    : await withTimeout(
        supabase
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false }),
      );
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => paymentFromRow(row as PaymentRow));
  if (!caps.supportsTrash) {
    return rows.filter((p) => !localTrashDeletedAt.has(p.id));
  }
  return rows;
}

/** Payments in the Pay > Trash view, newest trash first. */
export async function listDeletedPayments(): Promise<Payment[]> {
  const caps = await detectPaymentsCapabilities();
  if (caps.supportsTrash) {
    const { data, error } = await withTimeout(
      supabase
        .from("payments")
        .select("*")
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false }),
    );
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => paymentFromRow(row as PaymentRow));
  }
  if (localTrashDeletedAt.size === 0) return [];
  const { data, error } = await withTimeout(
    supabase.from("payments").select("*"),
  );
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => paymentFromRow(row as PaymentRow))
    .filter((p) => localTrashDeletedAt.has(p.id))
    .map((p) => ({
      ...p,
      isDeleted: true,
      deletedAt: localTrashDeletedAt.get(p.id),
    }));
}

export async function insertPayment(payment: Payment): Promise<Payment> {
  const { data, error } = await withTimeout(
    supabase
      .from("payments")
      .insert({
        id: payment.id,
        student_id: payment.studentId,
        amount: payment.amount,
        plan_type: payment.planType,
        payment_date: payment.paymentDate,
        status: payment.status ?? null,
      })
      .select()
      .single(),
  );
  if (error) throw new Error(error.message);
  return paymentFromRow(data as PaymentRow);
}

export async function insertPayments(payments: Payment[]): Promise<void> {
  if (payments.length === 0) return;
  const { error } = await withTimeout(
    supabase
      .from("payments")
      .insert(
        payments.map((p) => ({
          id: p.id,
          student_id: p.studentId,
          amount: p.amount,
          plan_type: p.planType,
          payment_date: p.paymentDate,
          status: p.status ?? null,
        })),
      ),
  );
  if (error) throw new Error(error.message);
}

/** One field-level change, stored in display-ready form. */
export interface PaymentFieldChange {
  field: string;
  from: string;
  to: string;
}

/** One recorded edit; entries are appended to payments.edit_history. */
export interface EditHistoryEntry {
  changedAt: string;
  changedBy: string;
  changes: PaymentFieldChange[];
}

/** An edit-history entry paired with its payment, for the History page. */
export interface PaymentHistoryItem {
  paymentId: string;
  studentName: string;
  entry: EditHistoryEntry;
}

const PLAN_LABELS: Record<string, string> = {
  one_time: "One-Time",
  semester: "Semester",
  monthly: "Monthly",
};

const PAYMENT_FIELD_COMPARATORS: {
  label: string;
  value: (p: Payment) => string;
}[] = [
  { label: "Student", value: (p) => p.studentName || "—" },
  { label: "Amount", value: (p) => p.amount.toFixed(2) },
  { label: "Plan Type", value: (p) => PLAN_LABELS[p.planType] ?? p.planType },
  { label: "Payment Date", value: (p) => p.paymentDate },
  {
    label: "Status",
    value: (p) =>
      p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "—",
  },
];

/** Fields that differ between two payments, in display-ready form. */
function paymentDiffs(before: Payment, after: Payment): PaymentFieldChange[] {
  const changes: PaymentFieldChange[] = [];
  for (const { label, value } of PAYMENT_FIELD_COMPARATORS) {
    const from = value(before);
    const to = value(after);
    if (from !== to) changes.push({ field: label, from, to });
  }
  return changes;
}

/**
 * Updates the editable fields of an existing payment and appends one entry
 * describing the change to the payment's edit_history (jsonb) column when that
 * column exists. The actor is the cookie session role — the Pay module is
 * operator-only, so this is always "operator".
 */
export async function updatePayment(
  before: Payment,
  after: Payment,
): Promise<void> {
  const changes = paymentDiffs(before, after);
  const payload: Record<string, unknown> = {
    student_id: after.studentId,
    amount: after.amount,
    plan_type: after.planType,
    payment_date: after.paymentDate,
    status: after.status ?? null,
  };
  const entry: EditHistoryEntry = {
    changedAt: new Date().toISOString(),
    changedBy: getRole() ?? "operator",
    changes,
  };
  const caps = await detectPaymentsCapabilities();
  if (caps.supportsHistory) {
    const { data: current } = await withTimeout(
      supabase
        .from("payments")
        .select("edit_history")
        .eq("id", after.id)
        .maybeSingle(),
    );
    const existing = Array.isArray(
      (current as { edit_history?: unknown } | null)?.edit_history,
    )
      ? ((current as { edit_history: unknown }).edit_history as EditHistoryEntry[])
      : [];
    payload.edit_history = [...existing, entry];
  } else {
    // No edit_history column: track this edit in-memory for the session.
    localEditHistory.push({
      paymentId: after.id,
      studentName: after.studentName,
      entry,
    });
  }
  const { error } = await withTimeout(
    supabase.from("payments").update(payload).eq("id", after.id),
  );
  if (error) throw new Error(error.message);
}

/**
 * Soft-deletes: flags the payment (is_deleted = true, deleted_at = NOW()) so
 * it appears in Pay > Trash instead of being destroyed. Without the flags the
 * delete is tracked in memory for the session only — no query against a
 * non-existent column is ever issued.
 */
export async function softDeletePayment(payment: Payment): Promise<void> {
  const caps = await detectPaymentsCapabilities();
  if (!caps.supportsTrash) {
    localTrashDeletedAt.set(payment.id, new Date().toISOString());
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("payments")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", payment.id),
  );
  if (error) throw new Error(error.message);
}

/** Restores a trashed payment back to the active list. */
export async function restorePayment(payment: Payment): Promise<void> {
  const caps = await detectPaymentsCapabilities();
  if (!caps.supportsTrash) {
    localTrashDeletedAt.delete(payment.id);
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("payments")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", payment.id),
  );
  if (error) throw new Error(error.message);
}

/**
 * Every recorded payment edit across all payments (incl. trashed), newest
 * first. When the edit_history column is missing this serves the in-memory
 * log from this session instead of querying it.
 */
export async function listPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const caps = await detectPaymentsCapabilities();
  const items: PaymentHistoryItem[] = [...localEditHistory];
  if (caps.supportsHistory) {
    const { data, error } = await withTimeout(
      supabase.from("payments").select("id, student_id, edit_history"),
    );
    if (error) throw new Error(error.message);
    const students = await listStudents();
    const studentNameFor = new Map(students.map((s) => [s.id, s.fullName]));
    for (const row of data ?? []) {
      const history = Array.isArray(row.edit_history)
        ? (row.edit_history as EditHistoryEntry[])
        : [];
      for (const entry of history) {
        items.push({
          paymentId: row.id,
          studentName: studentNameFor.get(row.student_id) ?? "Unknown student",
          entry,
        });
      }
    }
  }
  items.sort((a, b) => b.entry.changedAt.localeCompare(a.entry.changedAt));
  return items;
}

// ---------------------------------------------------------- general trash
//
// Students, teachers and publications share one Trash page (Payments has its
// own). Like the payments trash, these tables are probed at runtime: if a
// table lacks is_deleted/deleted_at, no query references the missing columns
// and the in-memory map below tracks the session's deletions instead.

export interface TrashCapabilities {
  students: boolean;
  teachers: boolean;
  publications: boolean;
  attendance: boolean;
}

let generalTrashCapabilitiesPromise: Promise<TrashCapabilities> | null = null;

async function hasColumn(table: string, column: string): Promise<boolean> {
  const { error } = await withTimeout(
    supabase.from(table).select(column).limit(1),
    PROBE_TIMEOUT_MS,
  );
  return !error;
}

/** Probes which tables actually carry the is_deleted/deleted_at columns. */
export async function generalTrashCapabilities(): Promise<TrashCapabilities> {
  if (!generalTrashCapabilitiesPromise) {
    generalTrashCapabilitiesPromise = (async () => {
      const [students, teachers, publications, attendance] = await Promise.all([
        Promise.all([hasColumn("students", "is_deleted"), hasColumn("students", "deleted_at")]),
        Promise.all([hasColumn("teachers", "is_deleted"), hasColumn("teachers", "deleted_at")]),
        Promise.all([
          hasColumn("publications", "is_deleted"),
          hasColumn("publications", "deleted_at"),
        ]),
        Promise.all([
          hasColumn("attendance", "is_deleted"),
          hasColumn("attendance", "deleted_at"),
        ]),
      ]);
      const and = (flags: boolean[]) => flags.every(Boolean);
      return {
        students: and(students),
        teachers: and(teachers),
        publications: and(publications),
        attendance: and(attendance),
      };
    })().catch(() => ({
      students: false,
      teachers: false,
      publications: false,
      attendance: false,
    }));
  }
  return generalTrashCapabilitiesPromise;
}

/** In-memory fallback used ONLY when the matching DB columns are absent. */
const localGeneralTrashDeletedAt = new Map<string, string>();
const generalTrashKey = (table: string, id: string) => `${table}:${id}`;

/** One row in the general Trash page, built across all trashable tables. */
export interface TrashItem {
  table: "students" | "teachers" | "publications" | "attendance";
  id: string;
  name: string;
  detail: string;
  deletedAt: string | null;
  /** For attendance rows: whether the absent person was a student or teacher. */
  personType?: "student" | "teacher";
}

/** Every soft-deleted row from the trashable tables, newest first. */
export async function listGeneralTrash(): Promise<{
  items: TrashItem[];
  capabilities: TrashCapabilities;
}> {
  const capabilities = await generalTrashCapabilities();
  const items: TrashItem[] = [];

  if (capabilities.students) {
    const { data, error } = await withTimeout(
      supabase
        .from("students")
        .select(STUDENT_SELECT)
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false }),
    );
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const s = studentFromRow(row as StudentRow);
      const raw = row as StudentRow;
      items.push({
        table: "students",
        id: s.id,
        name: s.fullName,
        detail: [s.program, s.training].filter(Boolean).join(" · ") || "—",
        deletedAt: raw.deleted_at ?? null,
      });
    }
  } else {
    for (const [key, deletedAt] of localGeneralTrashDeletedAt) {
      if (!key.startsWith("students:")) continue;
      const id = key.slice("students:".length);
      const s = await getStudentById(id);
      if (s)
        items.push({
          table: "students",
          id,
          name: s.fullName,
          detail: [s.program, s.training].filter(Boolean).join(" · ") || "—",
          deletedAt,
        });
    }
  }

  if (capabilities.teachers) {
    const { data, error } = await withTimeout(
      supabase
        .from("teachers")
        .select(TEACHER_SELECT)
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false }),
    );
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const t = teacherFromRow(row as TeacherRow);
      const raw = row as TeacherRow;
      items.push({
        table: "teachers",
        id: t.id,
        name: t.fullName,
        detail: t.specialty || "—",
        deletedAt: raw.deleted_at ?? null,
      });
    }
  } else {
    for (const [key, deletedAt] of localGeneralTrashDeletedAt) {
      if (!key.startsWith("teachers:")) continue;
      const id = key.slice("teachers:".length);
      const t = await getTeacherById(id);
      if (t)
        items.push({
          table: "teachers",
          id,
          name: t.fullName,
          detail: t.specialty || "—",
          deletedAt,
        });
    }
  }

  if (capabilities.publications) {
    const { data, error } = await withTimeout(
      supabase
        .from("publications")
        .select("*")
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false }),
    );
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const p = publicationFromRow(row as PublicationRow);
      const raw = row as { deleted_at?: string | null };
      items.push({
        table: "publications",
        id: p.id,
        name: p.title,
        detail: p.recipients.map((r) => r).join(", ") || "—",
        deletedAt: raw.deleted_at ?? null,
      });
    }
  } else {
    for (const [key, deletedAt] of localGeneralTrashDeletedAt) {
      if (!key.startsWith("publications:")) continue;
      const id = key.slice("publications:".length);
const p = (
      await withTimeout(
        supabase.from("publications").select("*").eq("id", id).maybeSingle(),
      )
    ).data as PublicationRow | null;
      if (p)
        items.push({
          table: "publications",
          id,
          name: p.title,
          detail: p.recipients?.join(", ") || "—",
          deletedAt,
        });
    }
  }

  if (capabilities.attendance) {
    const { data, error } = await withTimeout(
      supabase
        .from("attendance")
        .select("id, type, full_name, program, training, class_name, deleted_at")
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false }),
    );
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const a = row as {
        id: string;
        type: "student" | "teacher";
        full_name: string;
        program: string | null;
        training: string | null;
        class_name: string | null;
        deleted_at?: string | null;
      };
      items.push({
        table: "attendance",
        id: a.id,
        name: a.full_name,
        detail:
          [a.program, a.training].filter(Boolean).join(" - ") ||
          a.class_name ||
          "—",
        personType: a.type,
        deletedAt: a.deleted_at ?? null,
      });
    }
  } else {
    for (const [key, deletedAt] of localGeneralTrashDeletedAt) {
      if (!key.startsWith("attendance:")) continue;
      const id = key.slice("attendance:".length);
      const a = (
        await withTimeout(
          supabase
            .from("attendance")
            .select("id, type, full_name, program, training, class_name")
            .eq("id", id)
            .maybeSingle(),
        )
      ).data as {
        id: string;
        type: "student" | "teacher";
        full_name: string;
        program: string | null;
        training: string | null;
        class_name: string | null;
      } | null;
      if (a)
        items.push({
          table: "attendance",
          id,
          name: a.full_name,
          detail:
            [a.program, a.training].filter(Boolean).join(" - ") ||
            a.class_name ||
            "—",
          personType: a.type,
          deletedAt,
        });
    }
  }

  items.sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  return { items, capabilities };
}

// -------------------------------------------------------------- attendance

export interface AttendanceRecord {
  id: string;
  type: "student" | "teacher";
  fullName: string;
  className: string | null;
  program: string | null;
  training: string | null;
  date: string;
  time: string | null;
}

interface AttendanceRow {
  id: string;
  type: "student" | "teacher";
  full_name: string;
  class_name: string | null;
  program: string | null;
  training: string | null;
  date: string;
  time: string | null;
}

const ATTENDANCE_SELECT = "id, type, full_name, class_name, program, training, date, time";

function attendanceFromRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    type: row.type,
    fullName: row.full_name,
    className: row.class_name,
    program: row.program,
    training: row.training,
    date: row.date,
    time: row.time,
  };
}

/**
 * All attendance log rows, newest date/time first. Program/training are
 * resolved from the students/teachers tables when a row lacks them, so the
 * grid never shows dashes for records written before those columns existed.
 */
export async function loadAttendanceRecords(): Promise<AttendanceRecord[]> {
  const capabilities = await generalTrashCapabilities();
  const { data, error } = capabilities.attendance
    ? await withTimeout(
        supabase
          .from("attendance")
          .select(ATTENDANCE_SELECT)
          .or("is_deleted.is.false,is_deleted.is.null")
          .order("date", { ascending: false })
          .order("time", { ascending: false }),
      )
    : await withTimeout(
        supabase
          .from("attendance")
          .select(ATTENDANCE_SELECT)
          .order("date", { ascending: false })
          .order("time", { ascending: false }),
      );
  if (error) throw new Error(error.message);
  let records = (data ?? []).map((row) =>
    attendanceFromRow(row as AttendanceRow),
  );
  if (!capabilities.attendance) {
    records = records.filter(
      (a) => !localGeneralTrashDeletedAt.has(generalTrashKey("attendance", a.id)),
    );
  }
  return enrichAttendancePrograms(records);
}

/**
 * Backfills program/training (and class_name) for attendance rows that were
 * saved before those columns existed by looking up the person's own record.
 */
async function enrichAttendancePrograms(
  records: AttendanceRecord[],
): Promise<AttendanceRecord[]> {
  if (!records.some((r) => !r.program || !r.training)) return records;
  const [students, teachers] = await Promise.all([listStudents(), listTeachers()]);
  const studentByLowerName = new Map<string, Student>();
  for (const s of students) studentByLowerName.set(s.fullName.toLowerCase(), s);
  const teacherByLowerName = new Map<string, Teacher>();
  for (const t of teachers) teacherByLowerName.set(t.fullName.toLowerCase(), t);
  return records.map((r) => {
    if (r.type === "student") {
      const s = studentByLowerName.get(r.fullName.toLowerCase());
      if (!s) return r;
      return {
        ...r,
        program: r.program ?? s.program ?? null,
        training: r.training ?? s.training ?? null,
        className: r.className ?? s.training ?? null,
      };
    }
    const t = teacherByLowerName.get(r.fullName.toLowerCase());
    if (!t) return r;
    return {
      ...r,
      program: r.program ?? t.program ?? null,
      training: r.training ?? t.training ?? null,
      className: r.className ?? t.specialty ?? null,
    };
  });
}

/** A student's own attendance history (type=student), newest date first. */
export async function loadStudentAttendance(
  fullName: string,
): Promise<AttendanceRecord[]> {
  const capabilities = await generalTrashCapabilities();
  const { data, error } = capabilities.attendance
    ? await withTimeout(
        supabase
          .from("attendance")
          .select(ATTENDANCE_SELECT)
          .eq("type", "student")
          .eq("full_name", fullName)
          .or("is_deleted.is.false,is_deleted.is.null")
          .order("date", { ascending: false })
          .order("time", { ascending: false }),
      )
    : await withTimeout(
        supabase
          .from("attendance")
          .select(ATTENDANCE_SELECT)
          .eq("type", "student")
          .eq("full_name", fullName)
          .order("date", { ascending: false })
          .order("time", { ascending: false }),
      );
  if (error) throw new Error(error.message);
  let rows = (data ?? []).map((row) => attendanceFromRow(row as AttendanceRow));
  if (!capabilities.attendance) {
    rows = rows.filter(
      (a) => !localGeneralTrashDeletedAt.has(generalTrashKey("attendance", a.id)),
    );
  }
  return rows;
}

/** Shape accepted for writing attendance rows (modal + Excel import). */
export interface AttendanceInput {
  type: "student" | "teacher";
  fullName: string;
  className?: string | null;
  program?: string | null;
  training?: string | null;
  date: string;
  time?: string | null;
}

interface AttendanceWriteRow {
  type: "student" | "teacher";
  full_name: string;
  class_name: string;
  program: string | null;
  training: string | null;
  date: string | null;
  time: string | null;
}

interface AttendancePersonFallback {
  program: string | null;
  training: string | null;
  classFallback: string | null;
}

/**
 * Builds a lookup of program/training/class fallbacks for every person whose
 * attendance rows are missing them, so writes never leave the columns NULL
 * when the person's students/teachers record carries the values.
 */
async function resolveAttendancePeople(
  records: AttendanceInput[],
): Promise<Map<string, AttendancePersonFallback>> {
  const needed = records.some((r) => !r.program?.trim() || !r.training?.trim());
  if (!needed) return new Map();
  const [students, teachers] = await Promise.all([listStudents(), listTeachers()]);
  const people = new Map<string, AttendancePersonFallback>();
  for (const s of students) {
    people.set(`student:${s.fullName.toLowerCase()}`, {
      program: s.program ?? null,
      training: s.training ?? null,
      classFallback: s.training ?? null,
    });
  }
  for (const t of teachers) {
    people.set(`teacher:${t.fullName.toLowerCase()}`, {
      program: t.program ?? null,
      training: t.training ?? null,
      classFallback: t.specialty ?? null,
    });
  }
  return people;
}

async function attendanceToWriteRows(
  records: AttendanceInput[],
): Promise<AttendanceWriteRow[]> {
  const people = await resolveAttendancePeople(records);
  return records.map((r) => {
    const person = people.get(`${r.type}:${r.fullName.toLowerCase()}`);
    const program = r.program?.trim() || person?.program?.trim() || null;
    const training = r.training?.trim() || person?.training?.trim() || null;
    return {
      type: r.type,
      full_name: r.fullName,
      // class_name is NOT NULL in live deployments — always supply a value so
      // inserts never fail on the constraint (default matches existing rows).
      class_name:
        r.className?.trim() || training || program || person?.classFallback || "General",
      program,
      training,
      date: r.date || null,
      time: r.time?.trim() ? r.time.trim() : null,
    };
  });
}

/** Writes attendance rows straight into the attendance table. */
export async function insertAttendanceRecords(
  records: AttendanceInput[],
): Promise<void> {
  if (records.length === 0) return;
  const rows = await attendanceToWriteRows(records);
  const { error } = await withTimeout(supabase.from("attendance").insert(rows));
  if (error) throw new Error(error.message);
}

/** Updates an existing attendance row in place. */
export async function updateAttendanceRecord(
  id: string,
  input: AttendanceInput,
): Promise<void> {
  const [row] = await attendanceToWriteRows([input]);
  const { error } = await withTimeout(
    supabase.from("attendance").update(row).eq("id", id),
  );
  if (error) throw new Error(error.message);
}

/** Soft-deletes: moves rows to the general Trash when the columns exist. */
export async function softDeleteAttendance(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.attendance) {
    const now = new Date().toISOString();
    for (const id of ids)
      localGeneralTrashDeletedAt.set(generalTrashKey("attendance", id), now);
    return;
  }
  const now = new Date().toISOString();
  const { error } = await withTimeout(
    supabase
      .from("attendance")
      .update({ is_deleted: true, deleted_at: now })
      .in("id", ids),
  );
  if (error) throw new Error(error.message);
}

/** Restores soft-deleted attendance rows back to the active log. */
export async function restoreAttendance(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.attendance) {
    for (const id of ids)
      localGeneralTrashDeletedAt.delete(generalTrashKey("attendance", id));
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("attendance")
      .update({ is_deleted: false, deleted_at: null })
      .in("id", ids),
  );
  if (error) throw new Error(error.message);
}

/** Permanent delete: destroys rows immediately (used by the Trash page). */
export async function hardDeleteAttendance(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await withTimeout(
    supabase.from("attendance").delete().in("id", ids),
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- courses

interface CourseRow {
  id: string;
  title: string;
  program_id: string | null;
  training_id: string | null;
  teacher_id: string | null;
  programs: { code: string } | null;
  trainings: { name: string } | null;
  day: string;
  time: string;
  thumbnail_url: string | null;
  published_at: string | null;
  materials: CourseMaterial[] | null;
}

function courseFromRow(row: CourseRow): TeacherCourseRecord {
  return {
    id: row.id,
    teacherId: row.teacher_id ?? "",
    program: row.programs?.code ?? "",
    training: row.trainings?.name ?? "",
    programId: row.program_id ?? undefined,
    trainingId: row.training_id ?? undefined,
    name: row.title,
    day: row.day,
    time: row.time,
    thumbnail: row.thumbnail_url ?? undefined,
    published: row.published_at ?? undefined,
    materials: row.materials ?? undefined,
  };
}

const COURSE_SELECT = "*, programs(code), trainings(name)";

export async function listTeacherCourses(): Promise<TeacherCourseRecord[]> {
  return (await rows<CourseRow>("courses", undefined, COURSE_SELECT)).map(
    courseFromRow,
  );
}

/** Insert-or-update by id. Returns false when the write failed. */
export async function saveTeacherCourse(
  record: TeacherCourseRecord,
): Promise<boolean> {
  const { programId, trainingId } = await resolveProgramTrainingIds(
    record.program,
    record.training,
  );
  const payload = {
    id: record.id,
    title: record.name,
    program_id: programId || null,
    training_id: trainingId || null,
    day: record.day,
    time: record.time,
    teacher_id: record.teacherId,
    thumbnail_url: record.thumbnail ?? null,
    published_at: record.published ?? null,
    materials: record.materials ?? null,
  };
  const { error } = await withTimeout(
    supabase.from("courses").upsert(payload, {
      onConflict: "id",
    }),
  );
  return !error;
}

export async function deleteTeacherCourse(id: string): Promise<boolean> {
  const { error } = await withTimeout(
    supabase.from("courses").delete().eq("id", id),
  );
  return !error;
}

/**
 * Students enrolled in any course this teacher teaches. A teacher owns a
 * course through `courses.teacher_id`; each course's program/training is
 * matched against the student's assignment (by FK ids, falling back to the
 * joined names when the ids are missing). Returns the teacher's own courses
 * plus the matched students so callers can distinguish "no courses yet".
 */
export async function classRosterForTeacher(
  teacherId: string,
): Promise<{ courses: TeacherCourseRecord[]; students: Student[] }> {
  const [students, courses] = await Promise.all([
    listStudents(),
    listTeacherCourses(),
  ]);
  const ownCourses = courses.filter((c) => c.teacherId === teacherId);
  if (ownCourses.length === 0) return { courses: ownCourses, students: [] };

  const idPairs = new Set<string>();
  const namePairs = new Set<string>();
  for (const c of ownCourses) {
    if (c.programId && c.trainingId) idPairs.add(`${c.programId}:${c.trainingId}`);
    if (c.program && c.training) namePairs.add(`${c.program}:${c.training}`);
  }
  const studentsInClass = students.filter((s) => {
    if (s.programId && s.trainingId) {
      return idPairs.has(`${s.programId}:${s.trainingId}`);
    }
    return namePairs.has(`${s.program}:${s.training}`);
  });
  return { courses: ownCourses, students: studentsInClass };
}

// ------------------------------------------------------------------ exams

interface ExamRow {
  id: string;
  teacher_id: string;
  program: string;
  training: string;
  title: string;
  date: string;
  course: string | null;
  file_name: string | null;
}

function examFromRow(row: ExamRow): ExamRecord {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    program: row.program,
    training: row.training,
    title: row.title,
    date: row.date,
    course: row.course ?? undefined,
    attachment: row.file_name ?? undefined,
  };
}

export async function listExams(): Promise<ExamRecord[]> {
  return (await rows<ExamRow>("exams")).map(examFromRow);
}

export async function upsertExam(exam: ExamRecord): Promise<void> {
  const { error } = await withTimeout(
    supabase
      .from("exams")
      .upsert(
        {
          id: exam.id,
          teacher_id: exam.teacherId,
          program: exam.program,
          training: exam.training,
          title: exam.title,
          date: exam.date,
          course: exam.course ?? null,
          file_name: exam.attachment ?? null,
        },
        { onConflict: "id" },
      ),
  );
  if (error) throw new Error(error.message);
}

/** Deletes an exam together with its recorded grades. */
export async function deleteExamCascade(examId: string): Promise<void> {
  const { error: gradesError } = await withTimeout(
    supabase.from("grades").delete().eq("exam_id", examId),
  );
  if (gradesError) throw new Error(gradesError.message);
  const { error } = await withTimeout(
    supabase.from("exams").delete().eq("id", examId),
  );
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------- grades

interface GradeRow {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
}

function gradeFromRow(row: GradeRow): GradeRecord {
  return {
    id: row.id,
    examId: row.exam_id,
    studentId: row.student_id,
    score: Number(row.score),
  };
}

export async function listGrades(): Promise<GradeRecord[]> {
  return (await rows<GradeRow>("grades")).map(gradeFromRow);
}

export async function countGradesForExam(examId: string): Promise<number> {
  const { count, error } = await withTimeout(
    supabase
      .from("grades")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId),
  );
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Replaces all grades of one exam with the given scores (a blank input in
 * the grades table simply omits the student, which clears their grade).
 */
export async function saveGradesForExam(
  examId: string,
  scores: { studentId: string; score: number }[],
): Promise<void> {
  const { error: deleteError } = await withTimeout(
    supabase.from("grades").delete().eq("exam_id", examId),
  );
  if (deleteError) throw new Error(deleteError.message);
  if (scores.length === 0) return;
  const { error } = await withTimeout(
    supabase.from("grades").insert(
      scores.map((s) => ({
        exam_id: examId,
        student_id: s.studentId,
        score: s.score,
      })),
    ),
  );
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------- publications

interface PublicationRow {
  id: string;
  title: string;
  message: string;
  recipients: string[];
  channels: string[];
  sent_at: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

function publicationFromRow(row: PublicationRow): Publication {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    recipients: row.recipients as Publication["recipients"],
    channels: row.channels as Publication["channels"],
    createdAt: row.sent_at ?? "",
  };
}

export async function listPublications(): Promise<Publication[]> {
  const capabilities = await generalTrashCapabilities();
  const { data, error } = capabilities.publications
    ? await withTimeout(
        supabase
          .from("publications")
          .select("*")
          .or("is_deleted.is.false,is_deleted.is.null")
          .order("sent_at", { ascending: false }),
      )
    : await withTimeout(
        supabase
          .from("publications")
          .select("*")
          .order("sent_at", { ascending: false }),
      );
  if (error) throw new Error(error.message);
  let rowsArr = (data ?? []).map((row) =>
    publicationFromRow(row as PublicationRow),
  );
  if (!capabilities.publications) {
    rowsArr = rowsArr.filter(
      (p) => !localGeneralTrashDeletedAt.has(generalTrashKey("publications", p.id)),
    );
  }
  return rowsArr;
}

export async function insertPublication(
  publication: Publication,
): Promise<Publication> {
  const { data, error } = await withTimeout(
    supabase
      .from("publications")
      .insert({
        id: publication.id,
        title: publication.title,
        message: publication.message,
        recipients: publication.recipients,
        channels: publication.channels,
        sent_at: publication.createdAt,
      })
      .select()
      .single(),
  );
  if (error) throw new Error(error.message);
  return publicationFromRow(data as PublicationRow);
}

/** Permanent delete: destroys the publication immediately (Trash page). */
export async function hardDeletePublication(id: string): Promise<void> {
  const { error } = await withTimeout(
    supabase.from("publications").delete().eq("id", id),
  );
  if (error) throw new Error(error.message);
}

/** Soft-deletes: moves the publication to the general Trash when possible. */
export async function softDeletePublication(id: string): Promise<void> {
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.publications) {
    localGeneralTrashDeletedAt.set(
      generalTrashKey("publications", id),
      new Date().toISOString(),
    );
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("publications")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", id),
  );
  if (error) throw new Error(error.message);
}

/** Restores a trashed publication back to the active list. */
export async function restorePublication(id: string): Promise<void> {
  const capabilities = await generalTrashCapabilities();
  if (!capabilities.publications) {
    localGeneralTrashDeletedAt.delete(generalTrashKey("publications", id));
    return;
  }
  const { error } = await withTimeout(
    supabase
      .from("publications")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", id),
  );
  if (error) throw new Error(error.message);
}

// --------------------------------------------------------------- planning

interface PlanningRow {
  id: string;
  teacher_id: string;
  date: string;
  course: string | null;
  topic: string | null;
}

function planningFromRow(row: PlanningRow): PlanningRecord {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    date: row.date,
    course: row.course ?? undefined,
    content: row.topic ?? "",
  };
}

export async function listPlanning(): Promise<PlanningRecord[]> {
  return (await rows<PlanningRow>("planning")).map(planningFromRow);
}

export async function insertPlanning(record: PlanningRecord): Promise<void> {
  const { error } = await withTimeout(
    supabase.from("planning").insert({
      id: record.id,
      teacher_id: record.teacherId,
      date: record.date,
      course: record.course ?? null,
      topic: record.content,
    }),
  );
  if (error) throw new Error(error.message);
}

export async function updatePlanning(
  id: string,
  values: Pick<PlanningRecord, "course" | "content">,
): Promise<void> {
  const { error } = await withTimeout(
    supabase
      .from("planning")
      .update({ course: values.course ?? null, topic: values.content })
      .eq("id", id),
  );
  if (error) throw new Error(error.message);
}

export async function deletePlanning(id: string): Promise<void> {
  const { error } = await withTimeout(
    supabase.from("planning").delete().eq("id", id),
  );
  if (error) throw new Error(error.message);
}

// --------------------------------------------------------------- dashboard

export interface DashboardStats {
  studentCount: number;
  teacherCount: number;
  attendanceRate: number;
  monthlyRevenue: number;
  totalPaid: number;
  pendingAmount: number;
  revenueByMonth: { month: string; amount: number }[];
  revenueByPlan: { name: string; value: number }[];
  studentsByProgram: { program: string; count: number }[];
}

/**
 * Aggregates the KPI cards and charts for the operator Dashboard from the
 * live tables. All filtering (incl. trash exclusion) is inherited from the
 * list helpers.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [students, teachers, attendance, payments] = await Promise.all([
    listStudents(),
    listTeachers(),
    loadAttendanceRecords(),
    listPayments(),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentAttendance = attendance.filter((a) => {
    const d = new Date(a.date);
    return !Number.isNaN(d.getTime()) && d >= thirtyDaysAgo && d <= now;
  });
  const people = students.length + teachers.length;
  const attendanceRate =
    people > 0 ? Math.min(100, (recentAttendance.length / (30 * people)) * 100) : 0;

  const paid = payments.filter((p) => p.status === "paid");
  const sumPaid = (list: typeof paid) =>
    list.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = Math.round(sumPaid(paid) * 100) / 100;

  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRevenue =
    Math.round(
      sumPaid(paid.filter((p) => p.paymentDate.startsWith(thisMonthKey))) * 100,
    ) / 100;

  const pendingAmount =
    Math.round(
      payments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount), 0) * 100,
    ) / 100;

  const revenueByMonth: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revenueByMonth.push({
      month: d.toLocaleString(undefined, { month: "short" }),
      amount:
        Math.round(sumPaid(paid.filter((p) => p.paymentDate.startsWith(key))) * 100) /
        100,
    });
  }

  const planTotals: Record<string, number> = {};
  for (const p of paid) {
    planTotals[p.planType] = (planTotals[p.planType] ?? 0) + Number(p.amount);
  }
  const revenueByPlan = Object.entries(planTotals).map(([plan, value]) => ({
    name: PLAN_LABELS[plan] ?? (plan || "Unknown"),
    value: Math.round(value * 100) / 100,
  }));

  const programCounts: Record<string, number> = {};
  for (const s of students) {
    const key = s.program || "Unassigned";
    programCounts[key] = (programCounts[key] ?? 0) + 1;
  }
  const studentsByProgram = Object.entries(programCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([program, count]) => ({ program, count }));

  return {
    studentCount: students.length,
    teacherCount: teachers.length,
    attendanceRate,
    monthlyRevenue,
    totalPaid,
    pendingAmount,
    revenueByMonth,
    revenueByPlan,
    studentsByProgram,
  };
}

// ----------------------------------------------------------------- settings

export interface AppSettings {
  systemName?: string;
  universityName?: string;
  logoUrl?: string;
  language?: string;
  darkMode?: boolean;
}

type SettingsStore = Record<string, unknown>;

const SETTINGS_LOCAL_KEY = "ssm-settings";

/**
 * Settings are key/value rows in the `settings` table. When that table is
 * missing (or any read/write fails) the app degrades to a localStorage cache
 * instead of erroring, so the Settings page always renders. The cache is
 * written on every save, so dark mode can also be applied synchronously at
 * bootstrap (src/main.tsx) before Supabase responds.
 */
function readLocalSettingsStore(): SettingsStore {
  try {
    const raw = localStorage.getItem(SETTINGS_LOCAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return typeof parsed === "object" && parsed !== null
      ? (parsed as SettingsStore)
      : {};
  } catch {
    return {};
  }
}

function writeLocalSettingsStore(store: SettingsStore): void {
  try {
    localStorage.setItem(SETTINGS_LOCAL_KEY, JSON.stringify(store));
  } catch {
    // Quota/private-mode storage unavailable — the DB row is enough.
  }
}

function settingsFromStore(store: SettingsStore): AppSettings {
  return {
    systemName:
      typeof store.system_name === "string"
        ? (store.system_name as string)
        : undefined,
    universityName:
      typeof store.university_name === "string"
        ? (store.university_name as string)
        : undefined,
    logoUrl:
      typeof store.logo_url === "string" ? (store.logo_url as string) : undefined,
    language:
      typeof store.language === "string" ? (store.language as string) : undefined,
    darkMode: typeof store.dark_mode === "boolean" ? store.dark_mode : undefined,
  };
}

/** Synchronous localStorage-only lookup; used at bootstrap by main.tsx. */
export function getCachedSettings(): AppSettings {
  return settingsFromStore(readLocalSettingsStore());
}

/** Applies (or clears) the app-wide `.dark` class on <html>. */
export function applyDarkMode(enabled: boolean): void {
  document.documentElement.classList.toggle("dark", enabled);
}

/** Session key → value snapshot for the current settings (DB with local fallback). */
async function loadSettingsStore(): Promise<SettingsStore> {
  const { data, error } = await withTimeout(
    supabase.from("settings").select("key, value"),
  );
  if (error) return readLocalSettingsStore();
  const store: SettingsStore = {};
  for (const row of data ?? []) store[row.key as string] = row.value;
  return store;
}

/** Reads settings, falling back to the localStorage cache when the table is missing. */
export async function getSettings(): Promise<AppSettings> {
  return settingsFromStore(await loadSettingsStore());
}

/** Persists settings; the localStorage cache is always kept, DB failures fall back to it. */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const store: SettingsStore = {
    system_name: settings.systemName ?? null,
    university_name: settings.universityName ?? null,
    logo_url: settings.logoUrl ?? null,
    language: settings.language ?? null,
    dark_mode: settings.darkMode ?? null,
  };
  writeLocalSettingsStore(store);
  const now = new Date().toISOString();
  const rows = [
    { key: "system_name", value: store.system_name, updated_at: now },
    { key: "university_name", value: store.university_name, updated_at: now },
    { key: "logo_url", value: store.logo_url, updated_at: now },
    { key: "language", value: store.language, updated_at: now },
    { key: "dark_mode", value: store.dark_mode, updated_at: now },
  ];
  try {
    const { error } = await withTimeout(
      supabase
        .from("settings")
        .upsert(rows as Record<string, unknown>[], { onConflict: "key" }),
    );
    if (error) throw new Error(error.message);
  } catch {
    // Table missing — the localStorage cache already holds the values, so
    // the Settings page still works without a database round trip.
  }
}

/** Sidebar/top-bar branding; resilient to a missing settings table. */
export async function getSystemName(): Promise<string> {
  try {
    const settings = await getSettings();
    const name = settings.systemName?.trim();
    return name || "SSM";
  } catch {
    return "SSM";
  }
}

// -------------------------------------------------------------- realtime

/**
 * Subscribes to INSERT/UPDATE/DELETE events on one table and calls
 * `onChange` after each event (callers normally refetch their list).
 * Returns an unsubscribe function for useEffect cleanup. Only works for
 * tables added to the supabase_realtime publication — see
 * supabase/schema.sql.
 */
export function subscribeToTable(
  table: string,
  onChange: () => void,
): () => void {
  // Random suffix: two live subscriptions to the same table must not
  // share a channel name within one client.
  const channel = supabase
    .channel(`ssm-${table}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
