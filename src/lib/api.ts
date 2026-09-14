import { supabase } from "@/lib/supabase";
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
  const { data, error } = await builder;
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
    await supabase
      .from("programs")
      .select("id")
      .eq("code", programCode)
      .maybeSingle()
  ).data;
  const training = (
    await supabase
      .from("trainings")
      .select("id")
      .eq("name", trainingName)
      .maybeSingle()
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
  password: string | null;
  blocked: boolean | null;
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
    password: student.password ?? null,
    blocked: student.blocked === true,
  };
}

const STUDENT_SELECT = "*, programs(code), trainings(name)";

export async function listStudents(): Promise<Student[]> {
  return (
    await rows<StudentRow>("students", undefined, STUDENT_SELECT)
  ).map(studentFromRow);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? studentFromRow(data as StudentRow) : null;
}

/** Inserts a student; login fields are included when present. */
export async function insertStudent(student: Student): Promise<Student> {
  const row = await studentToRow(student);
  const { data, error } = await supabase
    .from("students")
    .insert(row)
    .select(STUDENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return studentFromRow(data as StudentRow);
}

/** Bulk insert used by the Excel import flow. */
export async function insertStudents(students: Student[]): Promise<void> {
  if (students.length === 0) return;
  const mapped = await Promise.all(students.map(studentToRow));
  const { error } = await supabase.from("students").insert(mapped);
  if (error) throw new Error(error.message);
}

/**
 * Updates only the profile fields the Add/Edit form owns. Login data
 * (password/blocked) is intentionally left untouched on edits.
 */
export async function updateStudentProfile(
  id: string,
  profile: Pick<Student, "fullName" | "program" | "training" | "phone" | "email">,
): Promise<void> {
  const { programId, trainingId } = await resolveProgramTrainingIds(
    profile.program,
    profile.training,
  );
  const { error } = await supabase
    .from("students")
    .update({
      full_name: profile.fullName,
      program_id: programId || null,
      training_id: trainingId || null,
      phone: profile.phone,
      email: profile.email,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteStudents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("students").delete().in("id", ids);
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
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, password, blocked, programs(code), trainings(name)");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? "",
    password: (r.password as string) ?? undefined,
    blocked: r.blocked === true,
    program: ((r.programs as { code: string } | null)?.code ?? "") as Student["program"],
    training: (r.trainings as { name: string } | null)?.name ?? "",
  }));
}

// ---------------------------------------------------------------- teachers

interface TeacherRow {
  id: string;
  full_name: string;
  specialty: string | null;
  phone: string;
  email: string;
  password: string | null;
  blocked: boolean | null;
}

function teacherFromRow(row: TeacherRow): Teacher {
  return {
    id: row.id,
    fullName: row.full_name,
    specialty: row.specialty ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
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
    password: teacher.password ?? null,
    blocked: teacher.blocked === true,
  };
}

const TEACHER_SELECT = "*";

export async function listTeachers(): Promise<Teacher[]> {
  return (
    await rows<TeacherRow>("teachers", undefined, TEACHER_SELECT)
  ).map(teacherFromRow);
}

export async function getTeacherById(id: string): Promise<Teacher | null> {
  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? teacherFromRow(data as TeacherRow) : null;
}

export async function insertTeacher(teacher: Teacher): Promise<Teacher> {
  const row = await teacherToRow(teacher);
  const { data, error } = await supabase
    .from("teachers")
    .insert(row)
    .select(TEACHER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return teacherFromRow(data as TeacherRow);
}

/** Bulk insert used by the Excel import flow. */
export async function insertTeachers(teachers: Teacher[]): Promise<void> {
  if (teachers.length === 0) return;
  const mapped = await Promise.all(teachers.map(teacherToRow));
  const { error } = await supabase.from("teachers").insert(mapped);
  if (error) throw new Error(error.message);
}

export async function updateTeacherProfile(
  id: string,
  profile: Pick<Teacher, "fullName" | "specialty" | "phone" | "email">,
): Promise<void> {
  const { error } = await supabase
    .from("teachers")
    .update({
      full_name: profile.fullName,
      specialty: profile.specialty ?? "",
      phone: profile.phone,
      email: profile.email,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTeachers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("teachers").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function listTeacherAccounts(): Promise<AccountInfo[]> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, password, blocked, specialty");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? "",
    password: (r.password as string) ?? undefined,
    blocked: r.blocked === true,
    program: "",
    training: "",
    specialty: (r.specialty as string | null) ?? "",
  }));
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
  const { error } = await supabase.from(kind).update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getBlocked(kind: AccountKind, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(kind)
    .select("blocked")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return (data as { blocked: boolean | null }).blocked === true;
}

// ---------------------------------------------------------------- payments

interface PaymentRow {
  id: string;
  student_id: string;
  amount: number;
  plan_type: string;
  date: string;
  status: string | null;
  student_name: string | null;
  student_program: string | null;
  student_training: string | null;
}

function paymentFromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    studentId: row.student_id,
    amount: Number(row.amount),
    planType: row.plan_type as Payment["planType"],
    date: row.date,
    status: row.status ?? undefined,
    studentName: row.student_name ?? "",
    studentProgram: row.student_program ?? "",
    studentTraining: row.student_training ?? "",
  };
}

export async function listPayments(): Promise<Payment[]> {
  return (await rows<PaymentRow>("payments")).map(paymentFromRow);
}

export async function insertPayment(payment: Payment): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      id: payment.id,
      student_id: payment.studentId,
      amount: payment.amount,
      plan_type: payment.planType,
      date: payment.date,
      status: payment.status ?? null,
      student_name: payment.studentName,
      student_program: payment.studentProgram,
      student_training: payment.studentTraining,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return paymentFromRow(data as PaymentRow);
}

export async function insertPayments(payments: Payment[]): Promise<void> {
  if (payments.length === 0) return;
  const { error } = await supabase
    .from("payments")
    .insert(
      payments.map((p) => ({
        id: p.id,
        student_id: p.studentId,
        amount: p.amount,
        plan_type: p.planType,
        date: p.date,
        status: p.status ?? null,
        student_name: p.studentName,
        student_program: p.studentProgram,
        student_training: p.studentTraining,
      })),
    );
  if (error) throw new Error(error.message);
}

// -------------------------------------------------------------- attendance

export type PersonType = "student" | "teacher";

export type AttendanceMap = Record<string, Record<string, boolean>>;

export async function loadAttendanceMap(
  personType: PersonType,
): Promise<AttendanceMap> {
  const tableRows = await rows<{
    person_id: string;
    date: string;
    present: boolean;
  }>("attendance", { eq: { person_type: personType } });
  const map: AttendanceMap = {};
  for (const r of tableRows) {
    const day = (map[r.date] ??= {});
    day[r.person_id] = r.present;
  }
  return map;
}

export async function setAttendanceMark(
  personType: PersonType,
  personId: string,
  date: string,
  present: boolean,
): Promise<void> {
  const { data } = await supabase
    .from("attendance")
    .select("person_id")
    .eq("person_type", personType)
    .eq("person_id", personId)
    .eq("date", date)
    .maybeSingle();
  if (data) {
    const { error } = await supabase
      .from("attendance")
      .update({ present })
      .eq("person_type", personType)
      .eq("person_id", personId)
      .eq("date", date);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("attendance")
      .insert({ person_type: personType, person_id: personId, date, present });
    if (error) throw new Error(error.message);
  }
}

export async function loadPersonAttendance(
  personType: PersonType,
  personId: string,
): Promise<{ date: string; present: boolean }[]> {
  const tableRows = await rows<{
    date: string;
    present: boolean;
  }>("attendance", { eq: { person_type: personType, person_id: personId } });
  return tableRows
    .map((r) => ({ date: r.date, present: r.present }))
    .sort((a, b) => b.date.localeCompare(a.date));
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
  const { error } = await supabase.from("courses").upsert(payload, {
    onConflict: "id",
  });
  return !error;
}

export async function deleteTeacherCourse(id: string): Promise<boolean> {
  const { error } = await supabase.from("courses").delete().eq("id", id);
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
  const { error } = await supabase
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
    );
  if (error) throw new Error(error.message);
}

/** Deletes an exam together with its recorded grades. */
export async function deleteExamCascade(examId: string): Promise<void> {
  const { error: gradesError } = await supabase
    .from("grades")
    .delete()
    .eq("exam_id", examId);
  if (gradesError) throw new Error(gradesError.message);
  const { error } = await supabase.from("exams").delete().eq("id", examId);
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
  const { count, error } = await supabase
    .from("grades")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
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
  const { error: deleteError } = await supabase
    .from("grades")
    .delete()
    .eq("exam_id", examId);
  if (deleteError) throw new Error(deleteError.message);
  if (scores.length === 0) return;
  const { error } = await supabase.from("grades").insert(
    scores.map((s) => ({
      exam_id: examId,
      student_id: s.studentId,
      score: s.score,
    })),
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
  return (
    await rows<PublicationRow>("publications", {
      order: { column: "sent_at", ascending: false },
    })
  ).map(publicationFromRow);
}

export async function insertPublication(
  publication: Publication,
): Promise<Publication> {
  const { data, error } = await supabase
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
    .single();
  if (error) throw new Error(error.message);
  return publicationFromRow(data as PublicationRow);
}

export async function deletePublication(id: string): Promise<void> {
  const { error } = await supabase
    .from("publications")
    .delete()
    .eq("id", id);
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
  const { error } = await supabase.from("planning").insert({
    id: record.id,
    teacher_id: record.teacherId,
    date: record.date,
    course: record.course ?? null,
    topic: record.content,
  });
  if (error) throw new Error(error.message);
}

export async function updatePlanning(
  id: string,
  values: Pick<PlanningRecord, "course" | "content">,
): Promise<void> {
  const { error } = await supabase
    .from("planning")
    .update({ course: values.course ?? null, topic: values.content })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePlanning(id: string): Promise<void> {
  const { error } = await supabase.from("planning").delete().eq("id", id);
  if (error) throw new Error(error.message);
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
