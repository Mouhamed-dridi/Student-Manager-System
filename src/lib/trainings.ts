import { listTeacherCourses } from "@/lib/api";

export const PROGRAMS = ["BTP", "BTS", "CAP"] as const;

export type Program = (typeof PROGRAMS)[number];

export const TRAININGS: Record<Program, string[]> = {
  CAP: ["Agent d'entrepôt", "Vendeur caissier étalagiste"],
  BTP: [
    "Préparateur en Pharmacie",
    "Technicien de Soutien en Informatique de Gestion",
    "Comptable d'entreprise",
    "Décoration et Design d'intérieur",
  ],
  BTS: [
    "Maintenance industrielle",
    "Commerce international",
    "Contrôle qualité",
    "Comptable d'entreprise",
    "Développement web",
    "Réseaux et sécurité informatique",
  ],
};

export interface ScheduledCourse {
  name: string;
  /** Optional now: teacher-created courses carry no manual schedule slot. */
  day?: string;
  time?: string;
}

// Prototype schedule data: courses offered per program and training.
export const COURSES: Record<Program, Partial<Record<string, ScheduledCourse[]>>> = {
  CAP: {
    "Gestion caissier": [
      { name: "Cash Register Fundamentals", day: "Monday", time: "08:30–10:30" },
      { name: "Customer Service & Sales", day: "Wednesday", time: "10:45–12:45" },
      { name: "Accounting Software Lab", day: "Friday", time: "14:00–16:00" },
    ],
    Photographe: [
      { name: "Camera & Exposure Basics", day: "Tuesday", time: "08:30–10:30" },
      { name: "Studio Lighting Workshop", day: "Thursday", time: "14:00–17:00" },
      { name: "Photo Editing Lab", day: "Saturday", time: "09:00–11:00" },
    ],
  },
  BTP: {
    "Gestion informatique": [
      { name: "Office Automation Tools", day: "Monday", time: "08:00–10:00" },
      { name: "Database Management", day: "Wednesday", time: "13:00–15:00" },
      { name: "IT Support Practice", day: "Friday", time: "10:15–12:15" },
    ],
    "Développement web": [
      { name: "HTML & CSS Foundations", day: "Monday", time: "10:30–12:30" },
      { name: "JavaScript Essentials", day: "Tuesday", time: "14:00–16:00" },
      { name: "Responsive Web Project", day: "Thursday", time: "08:30–11:30" },
    ],
    "Design infographique": [
      { name: "Graphic Design Principles", day: "Tuesday", time: "08:30–10:30" },
      { name: "Adobe Suite Workshop", day: "Thursday", time: "14:00–16:30" },
      { name: "Branding Mini-Project", day: "Friday", time: "13:00–15:00" },
    ],
  },
  BTS: {
    "Réseaux sécurité informatique": [
      { name: "Network Protocols", day: "Monday", time: "08:00–11:00" },
      { name: "System Administration", day: "Wednesday", time: "14:00–16:00" },
      { name: "Cybersecurity Fundamentals", day: "Friday", time: "08:30–10:30" },
    ],
    "Développement web mobile": [
      { name: "Mobile UI Development", day: "Tuesday", time: "10:30–12:30" },
      { name: "REST APIs & Integration", day: "Thursday", time: "08:00–10:00" },
      { name: "Cross-Platform App Project", day: "Friday", time: "14:00–17:00" },
    ],
    "Gestion et finance": [
      { name: "Financial Accounting", day: "Monday", time: "14:00–16:00" },
      { name: "Management Control", day: "Wednesday", time: "08:30–10:30" },
      { name: "Business Economics", day: "Thursday", time: "10:45–12:45" },
    ],
  },
};

export interface CourseMaterial {
  name: string;
  type: string;
  /** Supabase Storage public URL of the uploaded file (present once attached). */
  url?: string;
}

export interface TeacherCourseRecord {
  id: string;
  teacherId: string;
  program: string;
  training: string;
  programId?: string;
  trainingId?: string;
  name: string;
  description?: string;
  day?: string;
  time?: string;
  thumbnail?: string;
  published?: string;
  materials?: CourseMaterial[];
}

export interface ScheduledCourseView extends ScheduledCourse {
  id?: string;
  teacherId?: string;
  program?: string;
  training?: string;
  programId?: string;
  trainingId?: string;
  description?: string;
  thumbnail?: string;
  published?: string;
  materials?: CourseMaterial[];
}

// Teacher-created courses are scoped to the teacher's class. Prefer matching
// by the real foreign keys (program_id/training_id); fall back to the joined
const norm = (s: string | undefined | null) =>
  (s ?? "").trim().toLocaleLowerCase();

// A course belongs to a student's class when either their UUID FKs agree
// (both sides non-null) or the resolved program/training NAME text agrees
// (trimmed, case-insensitive) — guarding against whitespace/case drift in the
// joined programs(code)/trainings(name) strings.
function courseInClass(
  c: TeacherCourseRecord,
  program: string,
  training: string,
  assignment?: { programId?: string; trainingId?: string },
): boolean {
  if (
    assignment?.programId &&
    assignment.trainingId &&
    c.programId &&
    c.trainingId &&
    c.programId === assignment.programId &&
    c.trainingId === assignment.trainingId
  ) {
    return true;
  }
  return (
    norm(c.program) === norm(program) && norm(c.training) === norm(training)
  );
}

// Seeded entries carry no id/teacherId; teacher-created ones do.
// Teacher-created courses come from Supabase, so this is async now.
// The class of the student (program_id/training_id) is used as a server-side
// filter when both FKs exist; otherwise ALL course rows are fetched and the
// robust name comparison above picks the matches.
export async function loadScheduledCourses(
  program: string,
  training: string,
  assignment?: { programId?: string; trainingId?: string },
): Promise<ScheduledCourseView[]> {
  const seeded: ScheduledCourseView[] =
    COURSES[program as Program]?.[training] ?? [];
  const addedRows =
    assignment?.programId && assignment.trainingId
      ? await listTeacherCourses({
          programId: assignment.programId,
          trainingId: assignment.trainingId,
        })
      : await listTeacherCourses();
  const added = addedRows
    .filter((c) => courseInClass(c, program, training, assignment))
    .map(
      ({
        id,
        teacherId,
        program,
        training,
        programId,
        trainingId,
        name,
        description,
        day,
        time,
        thumbnail,
        published,
        materials,
      }) => ({
        id,
        teacherId,
        program,
        training,
        programId,
        trainingId,
        name,
        description,
        day,
        time,
        thumbnail,
        published,
        materials,
      }),
    );
  return [...seeded, ...added];
}
